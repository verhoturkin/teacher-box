import { DestroyRef } from '@angular/core';
import { fakeExcalidraw } from '@testing/excalidraw-fake';
import { ExcalidrawHost } from './excalidraw-host';

class ManualDestroyRef extends DestroyRef {
  private readonly callbacks: (() => void)[] = [];
  readonly destroyed = false;

  onDestroy(callback: () => void): () => void {
    this.callbacks.push(callback);
    return () => undefined;
  }

  destroy(): void {
    this.callbacks.forEach((callback) => {
      callback();
    });
  }
}

describe('ExcalidrawHost', () => {
  it('renders Excalidraw into its own React root with the given props', () => {
    const island = fakeExcalidraw();
    const container = document.createElement('div');
    const host = new ExcalidrawHost(island.modules, container, new ManualDestroyRef());

    host.render({ theme: 'dark', langCode: 'ru-RU' });

    expect(island.containers).toEqual([container]);
    expect(island.rendered).toEqual([
      { type: island.modules.Excalidraw, props: { theme: 'dark', langCode: 'ru-RU' }, key: null },
    ]);
  });

  it('unmounts once when its owner is destroyed and renders nothing after that', () => {
    const island = fakeExcalidraw();
    const destroyRef = new ManualDestroyRef();
    const host = new ExcalidrawHost(island.modules, document.createElement('div'), destroyRef);

    destroyRef.destroy();
    host.destroy();
    host.render({});

    expect(island.unmounted).toBe(1);
    expect(island.rendered).toEqual([]);
  });
});
