import type { SceneAccess } from '@features/boards/editor/board-sync';
import type {
  BoardMenuItem,
  BoardMenuSetting,
  ExcalidrawModules,
} from '@features/boards/editor/excalidraw-loader';

/** The props Excalidraw was rendered with (`ExcalidrawProps`, named through the island contract). */
export type RenderedProps = Parameters<ExcalidrawModules['createElement']>[1];

/** An Excalidraw element (`OrderedExcalidrawElement`, named through the island contract). */
export type IslandElement = ReturnType<ExcalidrawModules['reconcileElements']>[number];

/** A plain element for tests: only what the board editor reads. */
export function anElement(
  id: string,
  version: number,
  extra: Record<string, unknown> = {},
): IslandElement {
  const element: unknown = {
    id,
    version,
    versionNonce: 1,
    type: 'rectangle',
    isDeleted: false,
    index: `a${id}`,
    ...extra,
  };
  if (!isElement(element)) throw new Error('Not an element');
  return element;
}

function isElement(value: unknown): value is IslandElement {
  return typeof value === 'object' && value !== null && 'id' in value && 'version' in value;
}

/** What the fake island received: roots, rendered elements and props, unmounts. */
export interface FakeIsland {
  readonly modules: ExcalidrawModules;
  readonly containers: Element[];
  readonly rendered: unknown[];
  readonly props: RenderedProps[];
  /** The portal's items of the main menu, as last built. */
  menu: readonly BoardMenuItem[];
  /** The editor's settings at the end of the main menu, as last built. */
  settings: readonly BoardMenuSetting[];
  /** A setting or a choice of a group by its label. */
  setting(label: string): BoardMenuItem;
  unmounted: number;
  /** The props of the last render. */
  last(): RenderedProps;
}

/** React, ReactDOM and Excalidraw replaced by plain functions: records calls, renders nothing. */
export function fakeExcalidraw(): FakeIsland {
  const island: FakeIsland = {
    containers: [],
    rendered: [],
    props: [],
    menu: [],
    settings: [],
    setting: (label) => {
      const found = island.settings
        .flatMap((setting) => ('items' in setting ? setting.items : [setting]))
        .find((item) => item.label === label);
      if (!found) throw new Error(`No setting ${label}`);
      return found;
    },
    unmounted: 0,
    last: () => {
      const props = island.props.at(-1);
      if (!props) throw new Error('Excalidraw was not rendered');
      return props;
    },
    modules: {
      createRoot: (container) => {
        island.containers.push(container);
        return {
          render: (node) => {
            island.rendered.push(node);
          },
          unmount: () => {
            island.unmounted++;
          },
        };
      },
      createElement: (type, props) => {
        island.props.push(props);
        return { type, props, key: null };
      },
      Excalidraw: () => null,
      mainMenu: (items, settings) => {
        island.menu = items;
        island.settings = settings;
        return null;
      },
      // The higher version wins, local elements keep their order (like Excalidraw, without the edge cases).
      reconcileElements: (local, remote) => {
        const merged = new Map(local.map((element) => [element.id, element]));
        for (const element of remote) {
          const current = merged.get(element.id);
          if (current === undefined || element.version > current.version) {
            merged.set(element.id, element);
          }
        }
        return [...merged.values()];
      },
      convertToExcalidrawElements: (skeletons) =>
        skeletons.map((skeleton, index) => anElement(`new-${String(index)}`, 1, { ...skeleton })),
    },
  };
  return island;
}

/** What the fake editor holds. */
export interface FakeSceneState {
  elements: IslandElement[];
  appState: Record<string, unknown>;
  files: Record<string, { id: string; dataURL: string; mimeType: string }>;
  updates: unknown[];
}

/** Excalidraw's imperative API on plain data: updates replace the elements and the appState. */
export function fakeScene(elements: IslandElement[] = []): {
  access: SceneAccess;
  state: FakeSceneState;
} {
  const state: FakeSceneState = {
    elements,
    appState: {
      viewBackgroundColor: '#ffffff',
      scrollX: 0,
      scrollY: 0,
      zoom: { value: 1 },
      width: 800,
      height: 600,
    },
    files: {},
    updates: [],
  };
  const access: unknown = {
    getSceneElementsIncludingDeleted: () => state.elements,
    getAppState: () => state.appState,
    getFiles: () => state.files,
    updateScene: (scene: { elements?: IslandElement[]; appState?: Record<string, unknown> }) => {
      state.updates.push(scene);
      if (scene.elements) state.elements = [...scene.elements];
      if (scene.appState) state.appState = scene.appState;
    },
    addFiles: (files: { id: string; dataURL: string; mimeType: string }[]) => {
      for (const file of files) state.files[file.id] = file;
    },
  };
  if (!isSceneAccess(access)) throw new Error('Not a scene');
  return { access, state };
}

function isSceneAccess(value: unknown): value is SceneAccess {
  return typeof value === 'object' && value !== null && 'updateScene' in value;
}
