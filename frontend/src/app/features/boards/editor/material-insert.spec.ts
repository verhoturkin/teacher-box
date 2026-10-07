import { anElement, fakeExcalidraw, fakeScene } from '@testing/excalidraw-fake';
import {
  BESIDE_GAP,
  FRAME_PADDING,
  PAGE_GAP,
  TEXT_WIDTH,
  insertMaterial,
  viewportCentre,
} from './material-insert';

describe('insertMaterial', () => {
  const island = fakeExcalidraw();
  const noPictures = (): Promise<Blob> => Promise.reject(new Error('No pictures'));
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
      noPictures,
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
      noPictures,
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

  it('puts pages in a row inside a frame named after them', async () => {
    Object.defineProperty(HTMLImageElement.prototype, 'decode', {
      configurable: true,
      value: () => Promise.resolve(),
    });
    vi.spyOn(HTMLImageElement.prototype, 'naturalWidth', 'get').mockReturnValue(1240);
    vi.spyOn(HTMLImageElement.prototype, 'naturalHeight', 'get').mockReturnValue(1754);
    const fetched: string[] = [];
    const pictures = (url: string): Promise<Blob> => {
      fetched.push(url);
      return Promise.resolve(new Blob(['png'], { type: 'image/png' }));
    };
    const { access, state } = fakeScene([anElement('a', 1)]);

    await insertMaterial(
      access,
      island.modules,
      { title: 'Spotlight 5, с. 2-3', mode: 'pages', pictures: ['/api/p/2', '/api/p/3'] },
      picture,
      pictures,
    );

    expect(fetched).toEqual(['/api/p/2', '/api/p/3']);
    expect(Object.values(state.files)).toHaveLength(2);
    // the view centre is (400, 300); two pages 620 wide with a gap of 24
    const rowWidth = 2 * 620 + PAGE_GAP;
    expect(state.elements.slice(1)).toEqual([
      expect.objectContaining({
        type: 'image',
        x: 400 - rowWidth / 2,
        y: 300 - 877 / 2,
        width: 620,
      }),
      expect.objectContaining({
        type: 'image',
        x: 400 - rowWidth / 2 + 620 + PAGE_GAP,
        y: 300 - 877 / 2,
      }),
      expect.objectContaining({
        type: 'frame',
        name: 'Spotlight 5, с. 2-3',
        children: ['page-0', 'page-1'],
        x: 400 - rowWidth / 2 - FRAME_PADDING,
        width: rowWidth + 2 * FRAME_PADDING,
        height: 877 + 2 * FRAME_PADDING,
      }),
    ]);
  });

  it('puts pages to the right of the drawing and shows them', async () => {
    Object.defineProperty(HTMLImageElement.prototype, 'decode', {
      configurable: true,
      value: () => Promise.resolve(),
    });
    vi.spyOn(HTMLImageElement.prototype, 'naturalWidth', 'get').mockReturnValue(1240);
    vi.spyOn(HTMLImageElement.prototype, 'naturalHeight', 'get').mockReturnValue(1754);
    const { access, state } = fakeScene([
      anElement('a', 1, { x: 100, y: -50, width: 200, height: 100 }),
      anElement('b', 1, { x: 900, y: -500, width: 50, height: 50, isDeleted: true }),
    ]);
    const scrollToContent = vi.fn();

    await insertMaterial(
      { ...access, scrollToContent },
      island.modules,
      { title: 'Скан', mode: 'pages', pictures: ['/api/p/1'] },
      picture,
      () => Promise.resolve(new Blob(['png'], { type: 'image/png' })),
    );

    expect(state.elements[2]).toMatchObject({
      type: 'image',
      x: 300 + BESIDE_GAP + FRAME_PADDING,
      y: -50 + FRAME_PADDING,
    });
    expect(state.elements[3]).toMatchObject({ type: 'frame', x: 300 + BESIDE_GAP, y: -50 });
    expect(scrollToContent).toHaveBeenCalledWith(state.elements.slice(2), {
      fitToContent: true,
      animate: true,
    });
  });
});
