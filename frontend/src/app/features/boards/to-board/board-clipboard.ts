import { Clipboard } from '@angular/cdk/clipboard';
import { Injectable, inject } from '@angular/core';
import { renderMarkdown } from '@shared/ui/markdown-view';

/** Width of the picture of a material, CSS pixels. */
export const PICTURE_WIDTH = 800;
/** Pixels per CSS pixel of the picture: sharp on high-density screens and when zoomed on a board. */
export const PICTURE_SCALE = 2;

/** HTML of a material: its title and the Markdown text. */
export function materialHtml(title: string, markdown: string): string {
  return `<h2>${escapeHtml(title)}</h2>${renderMarkdown(markdown)}`;
}

/** Plain text of a material. */
export function materialText(title: string, markdown: string): string {
  return markdown.trim() === '' ? title : `${title}\n\n${markdown.trim()}`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** What the picture needs from a 2D canvas context. */
export interface PictureContext {
  fillStyle: string | CanvasGradient | CanvasPattern;
  scale(x: number, y: number): void;
  fillRect(x: number, y: number, width: number, height: number): void;
  drawImage(image: HTMLImageElement, x: number, y: number): void;
}

/**
 * Puts a material on the clipboard for pasting on a board (Holst has no API for boards,
 * ADR-0012): formatted text with a plain-text fallback, or a picture.
 */
@Injectable({ providedIn: 'root' })
export class BoardClipboard {
  private readonly clipboard = inject(Clipboard);

  /** The browser writes formatted text and pictures (only on https or localhost). */
  canWriteRich(): boolean {
    return 'clipboard' in navigator && typeof ClipboardItem !== 'undefined';
  }

  async copyText(title: string, markdown: string): Promise<void> {
    const text = materialText(title, markdown);
    if (!this.canWriteRich()) {
      if (!this.clipboard.copy(text)) {
        throw new Error('The text was not copied');
      }
      return;
    }
    await navigator.clipboard.write([
      new ClipboardItem({
        'text/html': new Blob([materialHtml(title, markdown)], { type: 'text/html' }),
        'text/plain': new Blob([text], { type: 'text/plain' }),
      }),
    ]);
  }

  /** The picture is rendered while the clipboard waits for it (the click still counts as the gesture). */
  async copyImage(title: string, markdown: string): Promise<void> {
    if (!this.canWriteRich()) {
      throw new Error('Pictures need the asynchronous clipboard');
    }
    await navigator.clipboard.write([
      new ClipboardItem({ 'image/png': this.picture(materialHtml(title, markdown)) }),
    ]);
  }

  /** Draws the HTML on a canvas through an SVG image (no libraries, works with the portal's CSP). */
  async picture(html: string): Promise<Blob> {
    const box = document.createElement('div');
    box.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
    box.style.cssText = [
      'position:fixed',
      'left:-10000px',
      'top:0',
      `width:${String(PICTURE_WIDTH)}px`,
      'padding:24px',
      'box-sizing:border-box',
      'background:#fff',
      'color:#1e1e1e',
      'font:16px/1.5 Arial,Helvetica,sans-serif',
    ].join(';');
    box.innerHTML = html;
    document.body.appendChild(box);
    const height = Math.max(1, Math.ceil(box.getBoundingClientRect().height));
    box.style.position = 'static';
    const xhtml = new XMLSerializer().serializeToString(box);
    box.remove();
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="${String(PICTURE_WIDTH)}" height="${String(height)}">` +
      `<foreignObject width="100%" height="100%">${xhtml}</foreignObject></svg>`;
    const image = new Image();
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = PICTURE_WIDTH * PICTURE_SCALE;
    canvas.height = height * PICTURE_SCALE;
    const context = this.context(canvas);
    if (context === null) {
      throw new Error('Canvas is not available');
    }
    context.scale(PICTURE_SCALE, PICTURE_SCALE);
    context.fillStyle = '#fff';
    context.fillRect(0, 0, PICTURE_WIDTH, height);
    context.drawImage(image, 0, 0);
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob === null) {
          reject(new Error('The picture was not made'));
        } else {
          resolve(blob);
        }
      }, 'image/png');
    });
  }

  /** The 2D context of the canvas (replaced in tests: jsdom has no canvas). */
  context(canvas: HTMLCanvasElement): PictureContext | null {
    return canvas.getContext('2d');
  }
}
