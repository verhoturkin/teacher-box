/**
 * Colors for the scheme of the portal (ADR-0023): OKLCH ↔ sRGB `#rrggbb`, the WCAG contrast and the
 * difference of two colors. OKLCH tones are computed here, not by `oklch(from …)` in the browser.
 */

/** A color in OKLCH: lightness 0–1, chroma, hue in degrees. */
export interface Oklch {
  readonly l: number;
  readonly c: number;
  readonly h: number;
}

const HEX = /^#[0-9a-f]{6}$/i;

export function isHex(value: string): boolean {
  return HEX.test(value);
}

function channels(hex: string): [number, number, number] {
  const [red = 0, green = 0, blue = 0] = [1, 3, 5].map(
    (start) => parseInt(hex.slice(start, start + 2), 16) / 255,
  );
  return [red, green, blue];
}

function toLinear(value: number): number {
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function fromLinear(value: number): number {
  return value <= 0.0031308 ? value * 12.92 : 1.055 * value ** (1 / 2.4) - 0.055;
}

function oklab(hex: string): [number, number, number] {
  const [red, green, blue] = channels(hex);
  const [r, g, b] = [toLinear(red), toLinear(green), toLinear(blue)];
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

/** Linear sRGB of an OKLCH color; channels outside 0–1 are out of the sRGB gamut. */
function linearRgb({ l, c, h }: Oklch): [number, number, number] {
  const a = c * Math.cos((h * Math.PI) / 180);
  const b = c * Math.sin((h * Math.PI) / 180);
  const l1 = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m1 = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s1 = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l1 - 3.3077115913 * m1 + 0.2309699292 * s1,
    -1.2684380046 * l1 + 2.6097574011 * m1 - 0.3413193965 * s1,
    -0.0041960863 * l1 - 0.7034186147 * m1 + 1.707614701 * s1,
  ];
}

const EPSILON = 0.0001;

function inGamut(color: Oklch): boolean {
  return linearRgb(color).every((value) => value >= -EPSILON && value <= 1 + EPSILON);
}

export function toOklch(hex: string): Oklch {
  const [l, a, b] = oklab(hex);
  const c = Math.hypot(a, b);
  const h = c < 0.0001 ? 0 : ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360;
  return { l, c, h };
}

/** The color as `#rrggbb`; a chroma the sRGB gamut does not hold is reduced (hue and lightness kept). */
export function toHex(color: Oklch): string {
  let fitted = { ...color, l: Math.min(1, Math.max(0, color.l)) };
  if (!inGamut(fitted)) {
    let low = 0;
    let high = fitted.c;
    for (let step = 0; step < 24; step++) {
      const middle = (low + high) / 2;
      if (inGamut({ ...fitted, c: middle })) {
        low = middle;
      } else {
        high = middle;
      }
    }
    fitted = { ...fitted, c: low };
  }
  return (
    '#' +
    linearRgb(fitted)
      .map((value) => Math.round(Math.min(1, Math.max(0, fromLinear(value))) * 255))
      .map((value) => value.toString(16).padStart(2, '0'))
      .join('')
  );
}

function luminance(hex: string): number {
  const [red, green, blue] = channels(hex);
  return 0.2126 * toLinear(red) + 0.7152 * toLinear(green) + 0.0722 * toLinear(blue);
}

/** WCAG contrast ratio of two `#rrggbb` colors, from 1 to 21. */
export function contrast(first: string, second: string): number {
  const [lighter, darker] = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return ((lighter ?? 0) + 0.05) / ((darker ?? 0) + 0.05);
}

/** How different two colors look: the distance in OKLab × 100 (about 2 — barely, below 12 — alike). */
export function difference(first: string, second: string): number {
  const [l1, a1, b1] = oklab(first);
  const [l2, a2, b2] = oklab(second);
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2) * 100;
}

/**
 * The color, darker or lighter in its hue, until it has the contrast `min` to every one of `others`
 * (ADR-0023: the tone, not the shade of a palette, guarantees the contrast).
 */
export function readable(
  color: string,
  others: readonly string[],
  direction: 'darker' | 'lighter',
  min = 4.5,
): string {
  if (others.every((other) => contrast(color, other) >= min)) {
    return color;
  }
  const base = toOklch(color);
  const step = direction === 'darker' ? -0.005 : 0.005;
  let current = color;
  for (let l = base.l; l >= 0 && l <= 1; l += step) {
    current = toHex({ ...base, l });
    if (others.every((other) => contrast(current, other) >= min)) {
      return current;
    }
  }
  return current;
}
