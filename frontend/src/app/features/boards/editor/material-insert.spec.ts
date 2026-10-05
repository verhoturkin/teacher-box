import { anElement, fakeExcalidraw, fakeScene } from '@testing/excalidraw-fake';
import { TEXT_WIDTH, insertMaterial, viewportCentre } from './material-insert';

describe('insertMaterial', () => {
  const island = fakeExcalidraw();
  const picture = {
    picture: vi.fn(() => Promise.resolve(new Blob(['png'], { type: 'image/png' }))),
  };

  afterEach(() => {
    Reflect.deleteProperty(HTMLImageElement.prototype, 'decode');
    vi.restoreAllMocks();
  });

  it('finds the centre of the view in the scene', () => {
    expect(
      viewportCentre({ scrollX: -100, scrollY: 50, zoom: { value: 2 }, width: 800, height: 600 }),
    ).toEqual({ x: 300, y: 100 });
  });

  it('puts the text of a material at the centre', async () => {
    const { access, state } = fakeScene([anElement('a', 1)]);

    await insertMaterial(
      access,
      island.modules,
      { title: 'Дроби', markdown: 'Решите', mode: 'text' },
      picture,
    );

    expect(state.elements).toHaveLength(2);
    expect(state.elements[1]).toMatchObject({
      type: 'text',
      text: 'Дроби\n\nРешите',
      x: 400 - TEXT_WIDTH / 2,
      y: 300,
    });
    expect(state.updates).toEqual([expect.objectContaining({ captureUpdate: 'IMMEDIATELY' })]);
  });

  it('puts a picture of a material at the centre with its file', async () => {
    Object.defineProperty(HTMLImageElement.prototype, 'decode', {
      configurable: true,
      value: () => Promise.resolve(),
    });
    vi.spyOn(HTMLImageElement.prototype, 'naturalWidth', 'get').mockReturnValue(1600);
    vi.spyOn(HTMLImageElement.prototype, 'naturalHeight', 'get').mockReturnValue(400);
    const { access, state } = fakeScene();

    await insertMaterial(
      access,
      island.modules,
      { title: 'Дроби', markdown: 'Решите', mode: 'image' },
      picture,
    );

    const [file] = Object.values(state.files);
    expect(file?.mimeType).toBe('image/png');
    expect(state.elements[0]).toMatchObject({
      type: 'image',
      fileId: file?.id,
      width: 800,
      height: 200,
      x: 0,
      y: 200,
    });
  });
});
