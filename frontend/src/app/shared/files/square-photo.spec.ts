import { TestBed } from '@angular/core/testing';
import { PhotoContext, SquarePhoto } from './square-photo';

describe('SquarePhoto', () => {
  let drawImage: ReturnType<typeof vi.fn<PhotoContext['drawImage']>>;
  let encoded: Blob | null;
  let close: ReturnType<typeof vi.fn>;
  let canvas: HTMLCanvasElement | undefined;

  beforeEach(() => {
    drawImage = vi.fn<PhotoContext['drawImage']>();
    close = vi.fn();
    encoded = new Blob(['jpeg'], { type: 'image/jpeg' });
    canvas = undefined;
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(() => Promise.resolve({ width: 4000, height: 3000, close })),
    );
    vi.spyOn(SquarePhoto.prototype, 'context').mockImplementation((target) => {
      canvas = target;
      return { drawImage, fillRect: vi.fn(), fillStyle: '' };
    });
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(
      (callback: BlobCallback, type?: string) => {
        expect(type).toBe('image/jpeg');
        callback(encoded);
      },
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('cuts the middle square out of a photo and scales it down to 256 px', async () => {
    const photo = await TestBed.inject(SquarePhoto).from(new Blob(['photo']));

    expect(photo).toBe(encoded);
    expect(canvas?.width).toBe(256);
    expect(canvas?.height).toBe(256);
    expect(drawImage).toHaveBeenCalledWith(expect.anything(), 500, 0, 3000, 3000, 0, 0, 256, 256);
    expect(close).toHaveBeenCalled();
  });

  it('does not enlarge a small picture', async () => {
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(() => Promise.resolve({ width: 100, height: 120, close })),
    );

    await TestBed.inject(SquarePhoto).from(new Blob(['photo']));

    expect(canvas?.width).toBe(100);
    expect(drawImage).toHaveBeenCalledWith(expect.anything(), 0, 10, 100, 100, 0, 0, 100, 100);
  });

  it('draws on the 2D context of the canvas', () => {
    vi.mocked(SquarePhoto.prototype.context).mockRestore();
    const target = document.createElement('canvas');
    const getContext = vi.spyOn(target, 'getContext').mockReturnValue(null);

    expect(TestBed.inject(SquarePhoto).context(target)).toBeNull();
    expect(getContext).toHaveBeenCalledWith('2d');
  });

  it('fails when the picture cannot be encoded or drawn', async () => {
    encoded = null;
    await expect(TestBed.inject(SquarePhoto).from(new Blob(['photo']))).rejects.toThrow();
    expect(close).toHaveBeenCalled();

    vi.spyOn(SquarePhoto.prototype, 'context').mockReturnValue(null);
    await expect(TestBed.inject(SquarePhoto).from(new Blob(['photo']))).rejects.toThrow(
      'No 2D canvas',
    );
  });
});
