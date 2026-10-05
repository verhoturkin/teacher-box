import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  effect,
  inject,
  input,
  output,
  untracked,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import type { OrderedExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import type {
  AppState,
  BinaryFiles,
  ExcalidrawImperativeAPI,
  ExcalidrawInitialDataState,
  ExcalidrawProps,
} from '@excalidraw/excalidraw/types';
import { defer } from 'rxjs';
import { LoadState } from '@shared/ui/load-state';
import { LoadStateView } from '@shared/ui/load-state-view';
import type { LivePointer } from './board-live';
import { ExcalidrawHost } from './excalidraw-host';
import {
  BoardEditorProps,
  BoardLibrary,
  BoardMenuItem,
  BoardMenuSetting,
  ExcalidrawLoader,
  ExcalidrawModules,
} from './excalidraw-loader';

/** The portal theme the canvas follows. */
export type BoardTheme = 'light' | 'dark';

/** What the mouse wheel does over the canvas: zooms (a mouse) or scrolls (a touchpad, Excalidraw's own). */
export type BoardWheel = 'zoom' | 'scroll';

/** Pixels of a wheel «line» and «page» (Firefox reports lines): Excalidraw's zoom reads pixels. */
const LINE_PX = 40;
const PAGE_PX = 800;

/** What Excalidraw reports on every change of the scene. */
export interface BoardCanvasChange {
  readonly elements: readonly OrderedExcalidrawElement[];
  readonly appState: AppState;
  readonly files: BinaryFiles;
}

/** The mounted editor: its imperative API and the island's functions (merge, new elements). */
export interface BoardCanvasReady {
  readonly api: ExcalidrawImperativeAPI;
  readonly modules: ExcalidrawModules;
}

/** Excalidraw's own actions the portal does not use: files on disk and its theme switch. */
const UI_OPTIONS: ExcalidrawProps['UIOptions'] = {
  canvasActions: { loadScene: false, saveToActiveFile: false, toggleTheme: null },
};

/**
 * Excalidraw as an Angular component: the border of the React island (ADR-0028). The scene is read once,
 * when the editor mounts; later changes come out of `sceneChange`. The theme follows the input.
 */
@Component({
  selector: 'tb-board-canvas',
  imports: [LoadStateView],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div #surface class="tb-board-canvas__surface" [attr.aria-busy]="!state.ready()"></div>
    @if (!state.ready()) {
      <tb-load-state class="tb-board-canvas__state" [state]="state" what="доску" (retry)="load()" />
    }
  `,
  styles: `
    :host {
      position: relative;
      display: block;
      height: 100%;
      min-height: 20rem;
    }

    .tb-board-canvas__surface {
      position: absolute;
      inset: 0;
    }

    .tb-board-canvas__state {
      position: absolute;
      inset: 0;
      display: grid;
      place-content: center;
      background: var(--p-md-surface);
    }
  `,
})
export class BoardCanvas {
  /** The scene to start with; read when the editor mounts. */
  readonly scene = input<ExcalidrawInitialDataState | null>(null);
  readonly theme = input<BoardTheme>('light');
  /** The portal's items of the main menu (e.g. «Вернуться к доскам»). */
  readonly menu = input<readonly BoardMenuItem[]>([]);
  /** The editor's settings at the end of the main menu (theme, grid, wheel). */
  readonly settings = input<readonly BoardMenuSetting[]>([]);
  readonly wheel = input<BoardWheel>('zoom');
  /** Others are on the board (the live channel is open): Excalidraw shows them. */
  readonly collaborating = input(false);
  /** The user's Excalidraw library; read when the editor mounts. */
  readonly library = input<BoardLibrary | null>(null);
  readonly sceneChange = output<BoardCanvasChange>();
  /** The editor is mounted: its API arrives once. */
  readonly ready = output<BoardCanvasReady>();
  /** This user's cursor moved (scene coordinates). */
  readonly pointerMove = output<LivePointer>();

  protected readonly state = new LoadState();
  private readonly loader = inject(ExcalidrawLoader);
  private readonly destroyRef = inject(DestroyRef);
  private readonly surface = viewChild.required<ElementRef<HTMLElement>>('surface');
  private host: ExcalidrawHost | undefined;
  private modules: ExcalidrawModules | undefined;
  private initialData: ExcalidrawInitialDataState | null = null;

  /**
   * In zoom mode a plain wheel over the canvas zooms: the event goes to Excalidraw again as its own zoom
   * gesture (Ctrl + wheel). Ctrl, ⌘ and Shift (sideways scroll) keep Excalidraw's meaning.
   */
  private readonly zoomByWheel = (event: WheelEvent): void => {
    const target = event.target;
    if (this.wheel() !== 'zoom' || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (!(target instanceof HTMLCanvasElement)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const scale = event.deltaMode === 1 ? LINE_PX : event.deltaMode === 2 ? PAGE_PX : 1;
    target.dispatchEvent(
      new WheelEvent('wheel', {
        bubbles: true,
        cancelable: true,
        clientX: event.clientX,
        clientY: event.clientY,
        screenX: event.screenX,
        screenY: event.screenY,
        deltaX: event.deltaX * scale,
        deltaY: event.deltaY * scale,
        deltaMode: 0,
        ctrlKey: true,
        altKey: event.altKey,
      }),
    );
  };

  constructor() {
    const element = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    element.addEventListener('wheel', this.zoomByWheel, { capture: true, passive: false });
    this.destroyRef.onDestroy(() => {
      element.removeEventListener('wheel', this.zoomByWheel, { capture: true });
    });
    afterNextRender(() => {
      this.load();
    });
    effect(() => {
      this.theme();
      this.menu();
      this.settings();
      this.collaborating();
      untracked(() => {
        this.render();
      });
    });
  }

  protected load(): void {
    defer(() => this.loader.load())
      .pipe(this.state.track(), takeUntilDestroyed(this.destroyRef))
      .subscribe((modules) => {
        this.initialData = this.scene();
        this.modules = modules;
        this.host = new ExcalidrawHost(modules, this.surface().nativeElement, this.destroyRef);
        this.render();
      });
  }

  private render(): void {
    this.host?.render(this.props());
  }

  private props(): BoardEditorProps {
    const modules = this.modules;
    return {
      initialData: this.initialData,
      theme: this.theme(),
      langCode: 'ru-RU',
      UIOptions: UI_OPTIONS,
      // No embedded web pages on a board: a link stays a link.
      validateEmbeddable: () => false,
      onChange: (elements, appState, files) => {
        this.sceneChange.emit({ elements, appState, files });
      },
      isCollaborating: this.collaborating(),
      onPointerUpdate: ({ pointer, button }) => {
        this.pointerMove.emit({ x: pointer.x, y: pointer.y, tool: pointer.tool, button });
      },
      excalidrawAPI: (api) => {
        if (modules) this.ready.emit({ api, modules });
      },
      children: modules?.mainMenu(this.menu(), this.settings()),
      library: this.library() ?? undefined,
    };
  }
}
