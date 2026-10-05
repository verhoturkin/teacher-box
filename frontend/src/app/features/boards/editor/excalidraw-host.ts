import type { DestroyRef } from '@angular/core';
import type { BoardEditorProps, ExcalidrawModules, IslandRoot } from './excalidraw-loader';

/** One Excalidraw mounted into an element as a React root; unmounted with its Angular owner. */
export class ExcalidrawHost {
  private readonly root: IslandRoot;
  private mounted = true;

  constructor(
    private readonly modules: ExcalidrawModules,
    container: Element,
    destroyRef: DestroyRef,
  ) {
    this.root = modules.createRoot(container);
    destroyRef.onDestroy(() => {
      this.destroy();
    });
  }

  /** Renders (or re-renders) Excalidraw with these props; no JSX, so tsconfig stays as is. */
  render(props: BoardEditorProps): void {
    if (this.mounted) this.root.render(this.modules.createElement(this.modules.Excalidraw, props));
  }

  destroy(): void {
    if (!this.mounted) return;
    this.mounted = false;
    this.root.unmount();
  }
}
