import {
  Excalidraw,
  MainMenu,
  convertToExcalidrawElements,
  exportToBlob,
  reconcileElements,
  useHandleLibrary,
} from '@excalidraw/excalidraw';
import type { RemoteExcalidrawElement } from '@excalidraw/excalidraw/data/reconcile';
import type {
  NonDeletedExcalidrawElement,
  OrderedExcalidrawElement,
} from '@excalidraw/excalidraw/element/types';
import type { AppState, BinaryFiles, ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import { type ReactNode, createElement, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type {
  BoardEditorProps,
  BoardLibrary,
  BoardMenuItem,
  BoardMenuSetting,
  ExcalidrawModules,
} from './excalidraw-loader';

/**
 * React, ReactDOM and Excalidraw for the board editor (ADR-0028). Loaded only through `ExcalidrawLoader`
 * (dynamic `import()` of this file). Static imports on purpose: esbuild hands a code-split CommonJS module
 * (React) to a dynamic `import()` as its default export only, while static imports get the named exports.
 */
export const EXCALIDRAW_MODULES: ExcalidrawModules = {
  createRoot: (container) => createRoot(container),
  createElement: (type, props) => createElement(type, props),
  Excalidraw: BoardExcalidraw,
  mainMenu: (items, settings) =>
    createElement(
      MainMenu,
      null,
      ...items.map((item) => menuItem(item)),
      createElement(MainMenu.Separator, { key: 'separator' }),
      createElement(MainMenu.DefaultItems.SaveAsImage, { key: 'image' }),
      createElement(MainMenu.DefaultItems.Export, { key: 'export' }),
      createElement(MainMenu.DefaultItems.SearchMenu, { key: 'search' }),
      createElement(MainMenu.DefaultItems.ChangeCanvasBackground, { key: 'background' }),
      createElement(MainMenu.DefaultItems.ClearCanvas, { key: 'clear' }),
      createElement(MainMenu.DefaultItems.Help, { key: 'help' }),
      ...(settings.length > 0
        ? [createElement(MainMenu.Separator, { key: 'settings' }), ...settings.map(menuSetting)]
        : []),
    ),
  reconcileElements: (local, remote, appState) =>
    isRemote(remote) ? reconcileElements(local, remote, appState) : [...local],
  exportPreview: (elements, appState, files) =>
    previewExporter()({
      elements,
      appState: { ...appState, exportBackground: true },
      files,
      mimeType: 'image/png',
      maxWidthOrHeight: PREVIEW_SIZE,
      exportPadding: 16,
    }),
  convertToExcalidrawElements: (skeletons) =>
    convertToExcalidrawElements([...skeletons], { regenerateIds: true }),
};

/** The longer side of a preview, pixels: sharp in a card of the materials feed. */
const PREVIEW_SIZE = 800;

/**
 * `exportToBlob` comes from `@excalidraw/utils`, whose declarations the package does not ship: its type
 * cannot be resolved, so it is checked and typed here.
 */
type PreviewExporter = (options: {
  elements: readonly NonDeletedExcalidrawElement[];
  appState: Partial<AppState>;
  files: BinaryFiles;
  mimeType: 'image/png';
  maxWidthOrHeight: number;
  exportPadding: number;
}) => Promise<Blob>;

function previewExporter(): PreviewExporter {
  const exporter: unknown = exportToBlob;
  if (!isPreviewExporter(exporter)) throw new Error('Excalidraw has no exportToBlob');
  return exporter;
}

function isPreviewExporter(value: unknown): value is PreviewExporter {
  return typeof value === 'function';
}

function menuSetting(setting: BoardMenuSetting): ReactNode {
  return 'items' in setting
    ? createElement(MainMenu.Group, {
        key: setting.title,
        title: setting.title,
        children: setting.items.map((item) => menuItem(item, 'menuitemradio')),
      })
    : menuItem(setting, 'menuitemcheckbox');
}

/** An item of the menu; a setting shows a check mark when on and tells it to screen readers. */
function menuItem(item: BoardMenuItem, role?: 'menuitemradio' | 'menuitemcheckbox'): ReactNode {
  const setting = role !== undefined;
  return createElement(MainMenu.Item, {
    key: item.label,
    onSelect: () => {
      item.onSelect();
    },
    children: item.label,
    ...(setting
      ? {
          role,
          'aria-checked': item.checked === true,
          selected: item.checked === true,
          icon: createElement('i', {
            className: item.checked === true ? 'tb-i tb-i-check' : 'tb-i',
            'aria-hidden': true,
          }),
        }
      : {}),
  });
}

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
