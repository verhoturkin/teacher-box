import {
  Excalidraw,
  MainMenu,
  convertToExcalidrawElements,
  reconcileElements,
} from '@excalidraw/excalidraw';
import type { RemoteExcalidrawElement } from '@excalidraw/excalidraw/data/reconcile';
import type { OrderedExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import type { ExcalidrawModules } from './excalidraw-loader';

/**
 * React, ReactDOM and Excalidraw for the board editor (ADR-0028). Loaded only through `ExcalidrawLoader`
 * (dynamic `import()` of this file). Static imports on purpose: esbuild hands a code-split CommonJS module
 * (React) to a dynamic `import()` as its default export only, while static imports get the named exports.
 */
export const EXCALIDRAW_MODULES: ExcalidrawModules = {
  createRoot: (container) => createRoot(container),
  createElement: (type, props) => createElement(type, props),
  Excalidraw,
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

/** Elements from the server are what Excalidraw calls remote: the brand only marks where they came from. */
function isRemote(
  elements: readonly OrderedExcalidrawElement[],
): elements is readonly RemoteExcalidrawElement[] {
  return Array.isArray(elements);
}
