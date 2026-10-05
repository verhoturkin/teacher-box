import { ComponentFixture, TestBed } from '@angular/core/testing';
import { buttonByText, hostElement, readableText } from '@testing/dom';
import { FakeIsland, fakeExcalidraw } from '@testing/excalidraw-fake';
import { testProviders } from '@testing/setup';
import { BoardCanvas, BoardCanvasChange, BoardCanvasReady } from './board-canvas';
import { ExcalidrawLoader, ExcalidrawModules } from './excalidraw-loader';

describe('BoardCanvas', () => {
  let fixture: ComponentFixture<BoardCanvas>;
  let island: FakeIsland;
  let load: ReturnType<typeof vi.fn<() => Promise<ExcalidrawModules>>>;

  async function render(setup?: (canvas: ComponentFixture<BoardCanvas>) => void): Promise<void> {
    TestBed.configureTestingModule({
      imports: [BoardCanvas],
      providers: testProviders({ provide: ExcalidrawLoader, useValue: { load } }),
    });
    fixture = TestBed.createComponent(BoardCanvas);
    setup?.(fixture);
    await settle();
  }

  /** Lets the editor load (a promise after the first render) and shows the result. */
  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    await Promise.resolve();
    fixture.detectChanges();
  }

  beforeEach(() => {
    island = fakeExcalidraw();
    load = vi.fn(() => Promise.resolve(island.modules));
  });

  it('mounts Excalidraw with the scene, the portal theme and Russian', async () => {
    const scene = { elements: [], appState: { viewBackgroundColor: '#ffffff' } };
    await render((canvas) => {
      canvas.componentRef.setInput('scene', scene);
      canvas.componentRef.setInput('theme', 'dark');
    });

    const surface = hostElement(fixture).querySelector('.tb-board-canvas__surface');
    expect(island.containers).toEqual([surface]);
    expect(island.last()).toMatchObject({ initialData: scene, theme: 'dark', langCode: 'ru-RU' });
    expect(surface?.getAttribute('aria-busy')).toBe('false');
    expect(hostElement(fixture).querySelector('tb-load-state')).toBeNull();
  });

  it('shows the loading indicator until the editor arrives', async () => {
    load.mockReturnValue(new Promise(() => undefined));
    await render();

    expect(hostElement(fixture).querySelector('[role="status"]')).not.toBeNull();
    expect(hostElement(fixture).querySelector('[aria-busy="true"]')).not.toBeNull();
  });

  it('follows the portal theme without remounting', async () => {
    await render();

    fixture.componentRef.setInput('theme', 'dark');
    await settle();

    expect(island.last().theme).toBe('dark');
    expect(island.containers).toHaveLength(1);
  });

  it('reports every change of the scene', async () => {
    await render();
    const changes: BoardCanvasChange[] = [];
    fixture.componentInstance.sceneChange.subscribe((change) => changes.push(change));
    const appState = { viewBackgroundColor: '#fff' };

    // Excalidraw calls onChange with its own objects; the canvas passes them on as they are.
    Reflect.apply(island.last().onChange ?? fail, undefined, [[], appState, {}]);

    expect(changes).toEqual([{ elements: [], appState, files: {} }]);
  });

  it('builds the portal menu, keeps embeds off and hands out the editor API', async () => {
    const back = vi.fn();
    await render((canvas) => {
      canvas.componentRef.setInput('menu', [{ label: 'Вернуться к доскам', onSelect: back }]);
    });
    const ready: BoardCanvasReady[] = [];
    fixture.componentInstance.ready.subscribe((value) => ready.push(value));
    const props = island.last();

    expect(island.menu.map((item) => item.label)).toEqual(['Вернуться к доскам']);
    island.menu[0]?.onSelect();
    expect(back).toHaveBeenCalled();
    expect(props.UIOptions?.canvasActions).toMatchObject({ loadScene: false, toggleTheme: null });
    const validate = props.validateEmbeddable;
    expect(typeof validate === 'function' ? validate('https://x') : validate).toBe(false);

    const api = { id: 'api' };
    Reflect.apply(props.excalidrawAPI ?? fail, undefined, [api]);
    expect(ready).toEqual([{ api, modules: island.modules }]);
  });

  it('offers to retry when the editor did not load', async () => {
    load.mockRejectedValueOnce(new Error('offline'));
    await render();

    expect(readableText(hostElement(fixture))).toContain('Не удалось загрузить доску');
    expect(island.containers).toEqual([]);

    buttonByText(hostElement(fixture), 'Повторить').click();
    await settle();

    expect(load).toHaveBeenCalledTimes(2);
    expect(island.containers).toHaveLength(1);
    expect(hostElement(fixture).querySelector('tb-load-state')).toBeNull();
  });

  it('unmounts the editor with the component', async () => {
    await render();

    fixture.destroy();

    expect(island.unmounted).toBe(1);
  });

  it('does not mount when it is gone before the editor arrives', async () => {
    let arrive: (modules: ExcalidrawModules) => void = () => undefined;
    load.mockReturnValue(
      new Promise((resolve) => {
        arrive = resolve;
      }),
    );
    await render();

    fixture.destroy();
    arrive(island.modules);
    await Promise.resolve();

    expect(island.containers).toEqual([]);
  });
});

function fail(): never {
  throw new Error('Excalidraw got no onChange');
}
