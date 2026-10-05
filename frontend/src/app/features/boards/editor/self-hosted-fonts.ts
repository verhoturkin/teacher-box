/** Excalidraw's CDN, always added as the last font source (`ASSETS_FALLBACK_URL`). */
const EXCALIDRAW_CDN = 'https://esm.sh/';

type FontFaceConstructor = new (
  family: string,
  source: string | BufferSource,
  descriptors?: FontFaceDescriptors,
) => object;

/** The part of `window` the patch touches. */
export interface FontFaceHost {
  FontFace?: FontFaceConstructor;
}

const patched = new WeakSet<FontFaceHost>();

/**
 * Drops Excalidraw's CDN from font sources: fonts are self-hosted (`excalidraw-assets/`, ADR-0028) and the CSP
 * allows only `'self'`. Without this Chrome reports a CSP violation for every font face as soon as it is created
 * (hundreds per board), though nothing is fetched from the CDN. Other sources and other fonts stay as they are.
 */
export function selfHostFonts(host: FontFaceHost): void {
  const Native = host.FontFace;
  if (!Native || patched.has(host)) return;
  host.FontFace = class SelfHostedFontFace extends Native {
    constructor(family: string, source: string | BufferSource, descriptors?: FontFaceDescriptors) {
      super(family, typeof source === 'string' ? withoutCdn(source) : source, descriptors);
    }
  };
  patched.add(host);
}

/** `url(a) format('woff2'), url(https://esm.sh/…) format('woff2')` → `url(a) format('woff2')`. */
function withoutCdn(source: string): string {
  const sources = source.split(/,\s*(?=url\()/);
  const own = sources.filter((part) => !part.includes(`url(${EXCALIDRAW_CDN}`));
  return own.length > 0 && own.length < sources.length ? own.join(', ') : source;
}
