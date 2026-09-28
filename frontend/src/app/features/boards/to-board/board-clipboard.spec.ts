import { Clipboard } from '@angular/cdk/clipboard';
import { TestBed } from '@angular/core/testing';
import {
  BoardClipboard,
  PICTURE_SCALE,
  PICTURE_WIDTH,
  PictureContext,
  materialHtml,
  materialText,
} from './board-clipboard';

class FakeClipboardItem {
  constructor(readonly items: Record<string, Blob | Promise<Blob>>) {}
}

describe('BoardClipboard', () => {
  let clipboard: BoardClipboard;
  let write: ReturnType<typeof vi.fn<(items: ClipboardItem[]) => Promise<void>>>;

  beforeEach(() => {
    clipboard = TestBed.inject(BoardClipboard);
    write = vi.fn<(items: ClipboardItem[]) => Promise<void>>(() => Promise.resolve());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    Reflect.deleteProperty(navigator, 'clipboard');
    vi.restoreAllMocks();
  });

  function richClipboard(): void {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { write } });
    vi.stubGlobal('ClipboardItem', FakeClipboardItem);
  }

  function written(): Record<string, Blob | Promise<Blob>> {
    const item = write.mock.lastCall?.[0][0];
    if (!(item instanceof FakeClipboardItem)) {
      throw new Error('Nothing was written');
    }
    return item.items;
  }

  it('makes the material from its title and Markdown', () => {
    expect(materialHtml('<Дроби> & "доли"', '**Решите**')).toBe(
      '<h2>&lt;Дроби&gt; &amp; &quot;доли&quot;</h2><p><strong>Решите</strong></p>\n',
    );
    expect(materialText('Дроби', ' 1/2 + 1/3 \n')).toBe('Дроби\n\n1/2 + 1/3');
    expect(materialText('Дроби', '  ')).toBe('Дроби');
  });

  it('copies formatted text with a plain fallback', async () => {
    richClipboard();
    expect(clipboard.canWriteRich()).toBe(true);

    await clipboard.copyText('Дроби', 'Решите');

    const items = written();
    expect(Object.keys(items)).toEqual(['text/html', 'text/plain']);
    expect(items['text/html']).toBeInstanceOf(Blob);
  });

  it('copies plain text where the browser has no rich clipboard', async () => {
    const copy = vi
      .spyOn(TestBed.inject(Clipboard), 'copy')
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(false);
    expect(clipboard.canWriteRich()).toBe(false);

    await clipboard.copyText('Дроби', 'Решите');
    expect(copy).toHaveBeenCalledWith('Дроби\n\nРешите');
    await expect(clipboard.copyText('Дроби', 'Решите')).rejects.toThrow('The text was not copied');
    await expect(clipboard.copyImage('Дроби', 'Решите')).rejects.toThrow('asynchronous clipboard');
  });

  it('copies a picture of the material', async () => {
    richClipboard();
    const png = new Blob(['png'], { type: 'image/png' });
    const picture = vi.spyOn(clipboard, 'picture').mockResolvedValue(png);

    await clipboard.copyImage('Дроби', 'Решите');

    expect(picture).toHaveBeenCalledWith(materialHtml('Дроби', 'Решите'));
    await expect(written()['image/png']).resolves.toBe(png);
  });

  describe('picture', () => {
    let context: PictureContext & { drawn: HTMLImageElement[] };

    beforeEach(() => {
      Object.defineProperty(HTMLImageElement.prototype, 'decode', {
        configurable: true,
        value: () => Promise.resolve(),
      });
      context = {
        drawn: [],
        fillStyle: '',
        scale: vi.fn(),
        fillRect: vi.fn(),
        drawImage(image: HTMLImageElement) {
          this.drawn.push(image);
        },
      };
    });

    afterEach(() => {
      Reflect.deleteProperty(HTMLImageElement.prototype, 'decode');
    });

    it('draws the material through an SVG image', async () => {
      vi.spyOn(clipboard, 'context').mockReturnValue(context);
      const png = new Blob(['png'], { type: 'image/png' });
      const toBlob = vi
        .spyOn(HTMLCanvasElement.prototype, 'toBlob')
        .mockImplementation((callback) => {
          callback(png);
        });

      await expect(clipboard.picture('<h2>Дроби</h2>')).resolves.toBe(png);

      expect(context.scale).toHaveBeenCalledWith(PICTURE_SCALE, PICTURE_SCALE);
      expect(context.fillRect).toHaveBeenCalledWith(0, 0, PICTURE_WIDTH, 1);
      expect(context.drawn[0]?.src).toContain('data:image/svg+xml');
      expect(decodeURIComponent(context.drawn[0]?.src ?? '')).toContain('<h2>Дроби</h2>');
      expect(toBlob).toHaveBeenCalledWith(expect.any(Function), 'image/png');
      expect(document.body.textContent).not.toContain('Дроби');
    });

    it('fails without a canvas or a picture', async () => {
      vi.spyOn(clipboard, 'context').mockReturnValueOnce(null).mockReturnValue(context);
      await expect(clipboard.picture('<p>1</p>')).rejects.toThrow('Canvas is not available');

      vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) => {
        callback(null);
      });
      await expect(clipboard.picture('<p>1</p>')).rejects.toThrow('The picture was not made');
    });

    it('asks the canvas for its 2D context', () => {
      const canvas = document.createElement('canvas');
      const getContext = vi.spyOn(canvas, 'getContext').mockReturnValue(null);

      expect(clipboard.context(canvas)).toBeNull();
      expect(getContext).toHaveBeenCalledWith('2d');
    });
  });
});
