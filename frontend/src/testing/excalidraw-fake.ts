import type { ExcalidrawModules } from '@features/boards/editor/excalidraw-loader';

/** The props Excalidraw was rendered with (`ExcalidrawProps`, named through the island contract). */
export type RenderedProps = Parameters<ExcalidrawModules['createElement']>[1];

/** What the fake island received: roots, rendered elements and props, unmounts. */
export interface FakeIsland {
  readonly modules: ExcalidrawModules;
  readonly containers: Element[];
  readonly rendered: unknown[];
  readonly props: RenderedProps[];
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
    },
  };
  return island;
}
