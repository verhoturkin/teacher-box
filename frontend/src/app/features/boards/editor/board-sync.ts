import { signal } from '@angular/core';
import type { OrderedExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import type {
  AppState,
  BinaryFileData,
  BinaryFiles,
  ExcalidrawImperativeAPI,
} from '@excalidraw/excalidraw/types';
import { Observable, firstValueFrom } from 'rxjs';
import { BoardScene } from '../data-access/boards.models';
import type { ExcalidrawModules } from './excalidraw-loader';
import { binaryFile, dataUrlToBlob, elementsOf, sharedAppState } from './excalidraw-data';

/** How the drawing is kept: saved, being saved, or waiting for the server. */
export type SaveStatus = 'saved' | 'saving' | 'offline';

/** A pause in drawing before the save. */
export const SAVE_DELAY_MS = 1000;
/** How often an open board asks for the others' changes (ADR-0028: polling, no real time). */
export const POLL_INTERVAL_MS = 5000;
/** A failed save is tried again after this. */
export const RETRY_DELAY_MS = 5000;

/** The server side of a board the sync talks to (`BoardsApi`, bound to the board). */
export interface BoardServer {
  save(
    elements: readonly unknown[],
    appState: Readonly<Record<string, unknown>>,
    baseVersion: number,
  ): Observable<BoardScene>;
  changes(since: number): Observable<BoardScene | null>;
  upload(fileId: string, content: Blob): Observable<void>;
  file(fileId: string): Observable<Blob>;
}

/** The editor's API the sync uses. */
export type SceneAccess = Pick<
  ExcalidrawImperativeAPI,
  'getSceneElementsIncludingDeleted' | 'getAppState' | 'getFiles' | 'updateScene' | 'addFiles'
>;

/**
 * Keeps an open Excalidraw board and the server in step (ADR-0028): saves the changed elements after a
 * pause, applies the merged drawing from the answer, asks for the others' changes every few seconds while
 * the tab is visible, uploads new images once and fetches the missing ones.
 */
export class BoardSync {
  readonly status = signal<SaveStatus>('saved');

  private access: SceneAccess | undefined;
  private reconcile: ExcalidrawModules['reconcileElements'] | undefined;
  private sceneVersion: number;
  /** Element versions the server has. */
  private readonly known = new Map<string, number>();
  /** Images the server has. */
  private readonly uploaded = new Set<string>();
  private sharedState: string;
  private dirty = false;
  private running: Promise<boolean> | null = null;
  private saveTimer: ReturnType<typeof setTimeout> | undefined;
  private pollTimer: ReturnType<typeof setInterval> | undefined;
  private polling = false;
  private stopped = false;

  constructor(
    private readonly server: BoardServer,
    initial: BoardScene,
  ) {
    this.sceneVersion = initial.sceneVersion;
    this.remember(elementsOf(initial.elements));
    this.sharedState = sharedState(initial.appState);
  }

  /** The editor is mounted: fetch the images of the drawing and start polling. */
  attach(access: SceneAccess, modules: Pick<ExcalidrawModules, 'reconcileElements'>): void {
    this.access = access;
    this.reconcile = modules.reconcileElements;
    void this.fetchMissingFiles(access.getSceneElementsIncludingDeleted());
    this.pollTimer = setInterval(() => {
      void this.poll();
    }, POLL_INTERVAL_MS);
  }

  /** Excalidraw changed something: save after a pause if elements or the shared appState changed. */
  changed(elements: readonly OrderedExcalidrawElement[], appState: AppState): void {
    if (this.stopped) return;
    const newElements = elements.some((element) => this.known.get(element.id) !== element.version);
    if (!newElements && sharedState(appState) === this.sharedState) return;
    this.dirty = true;
    this.status.set('saving');
    this.schedule(SAVE_DELAY_MS);
  }

  /** Saves what is not saved yet. @returns whether everything is on the server */
  async flush(): Promise<boolean> {
    clearTimeout(this.saveTimer);
    if (this.running) await this.running;
    if (this.dirty) await this.save();
    return !this.dirty;
  }

  /** Asks for the others' changes now (e.g. after a copy was restored). */
  async poll(): Promise<void> {
    if (this.stopped || this.polling || this.dirty || this.running !== null || hidden()) return;
    this.polling = true;
    try {
      const scene = await firstValueFrom(this.server.changes(this.sceneVersion));
      if (scene !== null && !this.busy()) this.apply(scene);
      if (this.status() === 'offline' && !this.hasChanges()) this.status.set('saved');
    } catch {
      // Polling is quiet: the next poll tries again.
    } finally {
      this.polling = false;
    }
  }

  /** Not saved changes (read through a method: they change while requests run). */
  private hasChanges(): boolean {
    return this.dirty;
  }

  private busy(): boolean {
    return this.dirty || this.running !== null;
  }

  stop(): void {
    this.stopped = true;
    clearTimeout(this.saveTimer);
    clearInterval(this.pollTimer);
  }

  private schedule(delay: number): void {
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      void this.save();
    }, delay);
  }

  private save(): Promise<boolean> {
    this.running ??= this.saveOnce().finally(() => {
      this.running = null;
    });
    return this.running;
  }

  private async saveOnce(): Promise<boolean> {
    const access = this.access;
    if (access === undefined) return false;
    this.dirty = false;
    this.status.set('saving');
    const elements = access.getSceneElementsIncludingDeleted();
    const appState = access.getAppState();
    const changed = elements.filter((element) => this.known.get(element.id) !== element.version);
    try {
      await this.uploadFiles(changed, access.getFiles());
      const scene = await firstValueFrom(
        this.server.save(changed, sharedAppState(appState), this.sceneVersion),
      );
      this.sharedState = sharedState(appState);
      this.apply(scene);
      // Changes made while the request ran are saved next.
      const more = this.hasChanges();
      this.status.set(more ? 'saving' : 'saved');
      if (more) this.schedule(SAVE_DELAY_MS);
      return true;
    } catch {
      this.dirty = true;
      this.status.set('offline');
      if (!this.stopped) this.schedule(RETRY_DELAY_MS);
      return false;
    }
  }

  /** Merges the server's drawing into the editor without touching what is being drawn. */
  private apply(scene: BoardScene): void {
    const access = this.access;
    const reconcile = this.reconcile;
    if (access === undefined || reconcile === undefined) return;
    const remote = elementsOf(scene.elements);
    this.sceneVersion = scene.sceneVersion;
    this.remember(remote);
    const merged = reconcile(
      access.getSceneElementsIncludingDeleted(),
      remote,
      access.getAppState(),
    );
    const current = access.getAppState();
    // The shared appState (background, grid) only when the others changed it.
    const appState =
      sharedState(scene.appState) === sharedState(current)
        ? undefined
        : { ...current, ...sharedAppState(scene.appState) };
    access.updateScene({ elements: merged, appState, captureUpdate: 'NEVER' });
    this.sharedState = sharedState(scene.appState);
    void this.fetchMissingFiles(remote);
  }

  private remember(elements: readonly OrderedExcalidrawElement[]): void {
    for (const element of elements) {
      this.known.set(element.id, element.version);
      const fileId = fileIdOf(element);
      if (fileId !== null) this.uploaded.add(fileId);
    }
  }

  private async uploadFiles(
    elements: readonly OrderedExcalidrawElement[],
    files: BinaryFiles,
  ): Promise<void> {
    for (const element of elements) {
      const fileId = fileIdOf(element);
      const file = fileId === null ? undefined : files[fileId];
      if (fileId !== null && file !== undefined && !this.uploaded.has(fileId)) {
        await firstValueFrom(this.server.upload(fileId, dataUrlToBlob(file.dataURL)));
        this.uploaded.add(fileId);
      }
    }
  }

  private async fetchMissingFiles(elements: readonly OrderedExcalidrawElement[]): Promise<void> {
    const access = this.access;
    if (access === undefined) return;
    const present = access.getFiles();
    const missing = [
      ...new Set(
        elements.map(fileIdOf).filter((id): id is string => id !== null && !(id in present)),
      ),
    ];
    const loaded: BinaryFileData[] = [];
    for (const fileId of missing) {
      try {
        const blob = await firstValueFrom(this.server.file(fileId));
        loaded.push(await binaryFile(fileId, blob));
      } catch {
        // An image that cannot be fetched stays a placeholder.
      }
    }
    if (loaded.length > 0 && !this.stopped) access.addFiles(loaded);
  }
}

function hidden(): boolean {
  return typeof document !== 'undefined' && document.visibilityState === 'hidden';
}

function fileIdOf(element: OrderedExcalidrawElement): string | null {
  return element.type === 'image' && element.fileId !== null ? element.fileId : null;
}

function sharedState(appState: object): string {
  return JSON.stringify(sharedAppState(appState));
}
