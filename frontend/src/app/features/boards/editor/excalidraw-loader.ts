import { DOCUMENT, Injectable, InjectionToken, inject } from '@angular/core';
import type { ExcalidrawElementSkeleton } from '@excalidraw/excalidraw/data/transform';
import type { OrderedExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import type { AppState, ExcalidrawProps, LibraryItems } from '@excalidraw/excalidraw/types';
import type { ComponentType, ReactElement, ReactNode } from 'react';
import { selfHostFonts } from './self-hosted-fonts';

/** A React root as the island uses it (`react-dom/client`). */
export interface IslandRoot {
  render(node: ReactNode): void;
  unmount(): void;
}

/** An item of the portal in Excalidraw's main menu. */
export interface BoardMenuItem {
  readonly label: string;
  readonly onSelect: () => void;
  /** A setting: on (or the chosen one of a group) — marked; an action has none. */
  readonly checked?: boolean;
}

/** A setting with several choices, e.g. «Тема»: a titled group, the chosen item is checked. */
export interface BoardMenuGroup {
  readonly title: string;
  readonly items: readonly BoardMenuItem[];
}

/** A setting of the editor in the main menu: a switch («Сетка») or a group of choices. */
export type BoardMenuSetting = BoardMenuItem | BoardMenuGroup;

/** Where the user's Excalidraw library lives (the portal keeps it on the server, per user). */
export interface BoardLibrary {
  load(): Promise<LibraryItems>;
  save(items: LibraryItems): Promise<void>;
}

/** Excalidraw's props and the user's library, kept and restored by the island. */
export type BoardEditorProps = ExcalidrawProps & { readonly library?: BoardLibrary };

/**
 * The parts of React, ReactDOM and Excalidraw the board editor uses — a narrow contract so tests pass fakes
 * and never start React in jsdom (ADR-0028).
 */
export interface ExcalidrawModules {
  readonly createRoot: (container: Element) => IslandRoot;
  readonly createElement: (
    type: ComponentType<BoardEditorProps>,
    props: BoardEditorProps,
  ) => ReactElement;
  /** Excalidraw that also loads and saves the library through `library`. */
  readonly Excalidraw: ComponentType<BoardEditorProps>;
  /**
   * Excalidraw's main menu: the portal's items, Excalidraw's own (no links to its socials), then the
   * editor's settings.
   */
  readonly mainMenu: (
    items: readonly BoardMenuItem[],
    settings: readonly BoardMenuSetting[],
  ) => ReactNode;
  /** Excalidraw's merge of the local and the remote elements (keeps what is being drawn). */
  readonly reconcileElements: (
    local: readonly OrderedExcalidrawElement[],
    remote: readonly OrderedExcalidrawElement[],
    appState: AppState,
  ) => OrderedExcalidrawElement[];
  /** New elements from their skeletons (text, image) with fresh ids. */
  readonly convertToExcalidrawElements: (
    skeletons: readonly ExcalidrawElementSkeleton[],
  ) => OrderedExcalidrawElement[];
}

/**
 * The island's code: one dynamic `import()` of `excalidraw-island.ts`, the only file importing React and
 * Excalidraw. They land in lazy chunks and never in the initial bundle. A token so tests replace it.
 */
export const EXCALIDRAW_IMPORTS = new InjectionToken<() => Promise<ExcalidrawModules>>(
  'EXCALIDRAW_IMPORTS',
  {
    providedIn: 'root',
    factory: () => () => import('./excalidraw-island').then((island) => island.EXCALIDRAW_MODULES),
  },
);

/** Excalidraw's stylesheet: a non-injected style bundle (angular.json `inject: false`). */
export const EXCALIDRAW_STYLESHEET = 'excalidraw.css';

/** Self-hosted Excalidraw fonts (angular.json assets → `excalidraw-assets/fonts/`): no CDN, CSP stays `'self'`. */
export const EXCALIDRAW_ASSET_DIR = 'excalidraw-assets/';

declare global {
  interface Window {
    EXCALIDRAW_ASSET_PATH?: string | string[];
  }
}

/** Loads the island once per page life (styles, fonts path, code); a failed load is retried on the next call. */
@Injectable({ providedIn: 'root' })
export class ExcalidrawLoader {
  private readonly document = inject(DOCUMENT);
  private readonly importModules = inject(EXCALIDRAW_IMPORTS);
  private pending: Promise<ExcalidrawModules> | undefined;
  private styles: Promise<void> | undefined;

  load(): Promise<ExcalidrawModules> {
    this.pending ??= this.loadOnce().catch((error: unknown) => {
      this.pending = undefined;
      throw error;
    });
    return this.pending;
  }

  private async loadOnce(): Promise<ExcalidrawModules> {
    const window = this.document.defaultView;
    if (window) {
      window.EXCALIDRAW_ASSET_PATH = new URL(EXCALIDRAW_ASSET_DIR, this.document.baseURI).href;
      selfHostFonts(window);
    }
    this.styles ??= this.stylesheet().catch((error: unknown) => {
      this.styles = undefined;
      throw error;
    });
    const [modules] = await Promise.all([this.importModules(), this.styles]);
    return modules;
  }

  /** Adds Excalidraw's stylesheet and waits for it, so the editor never shows unstyled. */
  private stylesheet(): Promise<void> {
    const link = this.document.createElement('link');
    link.rel = 'stylesheet';
    link.href = EXCALIDRAW_STYLESHEET;
    const loaded = new Promise<void>((resolve, reject) => {
      link.addEventListener('load', () => {
        resolve();
      });
      link.addEventListener('error', () => {
        link.remove();
        reject(new Error(`${EXCALIDRAW_STYLESHEET} did not load`));
      });
    });
    this.document.head.append(link);
    return loaded;
  }
}
