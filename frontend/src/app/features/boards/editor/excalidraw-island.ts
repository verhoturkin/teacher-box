import {
  Excalidraw,
  MainMenu,
  convertToExcalidrawElements,
  reconcileElements,
  useHandleLibrary,
} from '@excalidraw/excalidraw';
import type { RemoteExcalidrawElement } from '@excalidraw/excalidraw/data/reconcile';
import type { OrderedExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import { createElement, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { BoardEditorProps, BoardLibrary, ExcalidrawModules } from './excalidraw-loader';

/**
 * React, ReactDOM and Excalidraw for the board editor (ADR-0028). Loaded only through `ExcalidrawLoader`
 * (dynamic `import()` of this file). Static imports on purpose: esbuild hands a code-split CommonJS module
 * (React) to a dynamic `import()` as its default export only, while static imports get the named exports.
 */
export const EXCALIDRAW_MODULES: ExcalidrawModules = {
  createRoot: (container) => createRoot(container),
  createElement: (type, props) => createElement(type, props),
  Excalidraw: BoardExcalidraw,
  mainMenu: (items) =>
    createElement(
      MainMenu,
      null,
      ...items.map((item) =>
        createElement(MainMenu.Item, {
          key: item.label,
          onSelect: () => {
            item.onSelect();
          },
          children: item.label,
        }),
      ),
      createElement(MainMenu.Separator, { key: 'separator' }),
      createElement(MainMenu.DefaultItems.SaveAsImage, { key: 'image' }),
      createElement(MainMenu.DefaultItems.Export, { key: 'export' }),
      createElement(MainMenu.DefaultItems.SearchMenu, { key: 'search' }),
      createElement(MainMenu.DefaultItems.ChangeCanvasBackground, { key: 'background' }),
      createElement(MainMenu.DefaultItems.ClearCanvas, { key: 'clear' }),
      createElement(MainMenu.DefaultItems.Help, { key: 'help' }),
    ),
  reconcileElements: (local, remote, appState) =>
    isRemote(remote) ? reconcileElements(local, remote, appState) : [...local],
  convertToExcalidrawElements: (skeletons) =>
    convertToExcalidrawElements([...skeletons], { regenerateIds: true }),
};

/**
 * Excalidraw with the user's library: loaded when the editor mounts, saved on every change. Libraries
 * from libraries.excalidraw.com are not installed: CSP keeps the portal on its own domain (ADR-0028).
 */
function BoardExcalidraw({ library, excalidrawAPI, ...props }: BoardEditorProps) {
  const [api, setApi] = useState<ExcalidrawImperativeAPI | null>(null);
  const adapter = useMemo(() => (library ? libraryAdapter(library) : undefined), [library]);
  useHandleLibrary({
    excalidrawAPI: adapter ? api : null,
    adapter: adapter ?? libraryAdapter(NO_LIBRARY),
    validateLibraryUrl: () => false,
  });
  return createElement(Excalidraw, {
    ...props,
    excalidrawAPI: (ready) => {
      setApi(ready);
      excalidrawAPI?.(ready);
    },
  });
}

const NO_LIBRARY: BoardLibrary = {
  load: () => Promise.resolve([]),
  save: () => Promise.resolve(),
};

function libraryAdapter(library: BoardLibrary) {
  return {
    load: async () => ({ libraryItems: await library.load() }),
    save: ({ libraryItems }: { libraryItems: Parameters<BoardLibrary['save']>[0] }) =>
      library.save(libraryItems),
  };
}

/** Elements from the server are what Excalidraw calls remote: the brand only marks where they came from. */
function isRemote(
  elements: readonly OrderedExcalidrawElement[],
): elements is readonly RemoteExcalidrawElement[] {
  return Array.isArray(elements);
}
