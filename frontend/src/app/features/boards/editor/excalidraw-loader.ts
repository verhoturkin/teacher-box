import { DOCUMENT, Injectable, InjectionToken, inject } from '@angular/core';
import type { ExcalidrawProps } from '@excalidraw/excalidraw/types';
import type { ComponentType, ReactElement, ReactNode } from 'react';

/** A React root as the island uses it (`react-dom/client`). */
export interface IslandRoot {
  render(node: ReactNode): void;
  unmount(): void;
}

/**
 * The parts of React, ReactDOM and Excalidraw the board editor uses — a narrow contract so tests pass fakes
 * and never start React in jsdom (ADR-0028).
 */
export interface ExcalidrawModules {
  readonly createRoot: (container: Element) => IslandRoot;
  readonly createElement: (
    type: ComponentType<ExcalidrawProps>,
    props: ExcalidrawProps,
  ) => ReactElement;
  readonly Excalidraw: ComponentType<ExcalidrawProps>;
}

/**
 * The dynamic imports of the island. This file is the only place that imports React and Excalidraw, and only
 * lazily: they land in their own chunks and never in the initial bundle.
 */
export const EXCALIDRAW_IMPORTS = new InjectionToken<() => Promise<ExcalidrawModules>>(
  'EXCALIDRAW_IMPORTS',
  {
    providedIn: 'root',
    factory: () => importExcalidraw,
  },
);

async function importExcalidraw(): Promise<ExcalidrawModules> {
  const [react, reactDom, excalidraw] = await Promise.all([
    import('react'),
    import('react-dom/client'),
    import('@excalidraw/excalidraw'),
  ]);
  return {
    createRoot: (container) => reactDom.createRoot(container),
    createElement: (type, props) => react.createElement(type, props),
    Excalidraw: excalidraw.Excalidraw,
  };
}

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
    if (window)
      window.EXCALIDRAW_ASSET_PATH = new URL(EXCALIDRAW_ASSET_DIR, this.document.baseURI).href;
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
