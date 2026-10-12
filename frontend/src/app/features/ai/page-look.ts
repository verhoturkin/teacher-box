import { PageLook } from './data-access/ai.models';

/** What the backend accepts in a font family: names, commas, quotes, spaces and hyphens. */
const FONT_CHARS = /[^\p{L}\p{N} ,'"-]/gu;
/** When the page's font cannot be read. */
const DEFAULT_FONT = 'system-ui, sans-serif';

/**
 * The portal's look as it is drawn now — the primary colour, the surface, the text and the font — for an interactive
 * page made by the AI; `null` when a colour cannot be read (the backend then uses its default).
 */
export function currentPageLook(root: Element = document.documentElement): PageLook | null {
  const style = getComputedStyle(root);
  const primary = hexColor(style.getPropertyValue('--p-md-primary'));
  const surface = hexColor(style.getPropertyValue('--p-md-surface'));
  const text = hexColor(style.getPropertyValue('--p-md-on-surface'));
  const font =
    getComputedStyle(document.body).fontFamily.replace(FONT_CHARS, '').trim().slice(0, 100) ||
    DEFAULT_FONT;
  return primary === null || surface === null || text === null
    ? null
    : { font, primary, surface, text };
}

/** `#rrggbb` from `#rgb`, `#rrggbb` or `rgb(r, g, b)`; `null` for anything else. */
export function hexColor(value: string): string | null {
  const color = value.trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(color)) {
    return color;
  }
  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/.exec(color);
  if (short !== null) {
    return `#${short
      .slice(1)
      .map((digit) => digit + digit)
      .join('')}`;
  }
  const rgb = /^rgba?\(\s*(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})/.exec(color);
  if (rgb === null) {
    return null;
  }
  const channels = rgb.slice(1, 4).map(Number);
  return channels.some((channel) => channel > 255)
    ? null
    : `#${channels.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
}
