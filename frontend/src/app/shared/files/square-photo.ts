import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';

/** What drawing a photo needs of a canvas. */
export interface PhotoContext {
  fillStyle: CanvasRenderingContext2D['fillStyle'];
  fillRect(x: number, y: number, width: number, height: number): void;
  drawImage(
    image: CanvasImageSource,
    sx: number,
    sy: number,
    sw: number,
    sh: number,
    dx: number,
    dy: number,
    dw: number,
    dh: number,
  ): void;
}

/** The side of an avatar sent to the server, px: sharp in a 96 px circle on a 2× screen. */
export const AVATAR_SIDE = 256;

/**
 * Prepares a photo for an avatar in the browser: the middle square is cut out and scaled down, so a
 * 10 MB phone picture becomes a JPEG of a few dozen kilobytes (the server takes up to 1 MB).
 */
@Injectable({ providedIn: 'root' })
export class SquarePhoto {
  private readonly document = inject(DOCUMENT);

  /** @throws when the file is not an image the browser can open */
  async from(file: Blob, side = AVATAR_SIDE): Promise<Blob> {
    const image = await createImageBitmap(file);
    try {
      const crop = Math.min(image.width, image.height);
      const canvas = this.document.createElement('canvas');
      canvas.width = Math.min(side, crop);
      canvas.height = canvas.width;
      const context = this.context(canvas);
      if (context === null) {
        throw new Error('No 2D canvas');
      }
      // JPEG has no transparency: a transparent PNG lies on white, not on black
      context.fillStyle = '#fff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(
        image,
        (image.width - crop) / 2,
        (image.height - crop) / 2,
        crop,
        crop,
        0,
        0,
        canvas.width,
        canvas.height,
      );
      return await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (blob) => {
            if (blob === null) {
              reject(new Error('The photo was not encoded'));
            } else {
              resolve(blob);
            }
          },
          'image/jpeg',
          0.9,
        );
      });
    } finally {
      image.close();
    }
  }

  /** The 2D context of the canvas (replaced in tests: jsdom has no canvas). */
  context(canvas: HTMLCanvasElement): PhotoContext | null {
    return canvas.getContext('2d');
  }
}
