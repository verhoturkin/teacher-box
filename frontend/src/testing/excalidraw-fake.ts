import type { ExcalidrawModules } from '@features/boards/editor/excalidraw-loader';

/** What the fake root received: rendered element props and whether it was unmounted. */
export interface FakeIsland {
  readonly modules: ExcalidrawModules;
  readonly containers: Element[];
  readonly rendered: unknown[];
  unmounted: number;
}

/** React, ReactDOM and Excalidraw replaced by plain functions: records calls, renders nothing. */
export function fakeExcalidraw(): FakeIsland {
  const island: FakeIsland = {
    containers: [],
    rendered: [],
    unmounted: 0,
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
      createElement: (type, props) => ({ type, props, key: null }),
      Excalidraw: () => null,
    },
  };
  return island;
}
