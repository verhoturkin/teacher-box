import { Injectable, InjectionToken, inject } from '@angular/core';
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

/** Loads the island once per page life; a failed load is retried on the next call. */
@Injectable({ providedIn: 'root' })
export class ExcalidrawLoader {
  private readonly importModules = inject(EXCALIDRAW_IMPORTS);
  private pending: Promise<ExcalidrawModules> | undefined;

  load(): Promise<ExcalidrawModules> {
    this.pending ??= this.importModules().catch((error: unknown) => {
      this.pending = undefined;
      throw error;
    });
    return this.pending;
  }
}
