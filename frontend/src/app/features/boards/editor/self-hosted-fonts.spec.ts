import { FontFaceHost, selfHostFonts } from './self-hosted-fonts';

/** What the browser's FontFace was given. */
const sources: (string | BufferSource)[] = [];

class RecordingFontFace {
  constructor(
    readonly family: string,
    source: string | BufferSource,
  ) {
    sources.push(source);
  }
}

describe('selfHostFonts', () => {
  function patchedHost(): Required<FontFaceHost> {
    sources.length = 0;
    const host: FontFaceHost = {
      FontFace: RecordingFontFace,
    };
    selfHostFonts(host);
    if (!host.FontFace) throw new Error('no FontFace');
    return { FontFace: host.FontFace };
  }

  it("drops Excalidraw's CDN and keeps the self-hosted source", () => {
    const { FontFace } = patchedHost();

    new FontFace(
      'Virgil',
      "url(http://portal/excalidraw-assets/fonts/Virgil.woff2) format('woff2'), " +
        "url(https://esm.sh/@excalidraw/excalidraw@0.18.1/dist/prod/fonts/Virgil.woff2) format('woff2')",
    );

    expect(sources).toEqual([
      "url(http://portal/excalidraw-assets/fonts/Virgil.woff2) format('woff2')",
    ]);
  });

  it('leaves other fonts, binary sources and CDN-only faces alone', () => {
    const { FontFace } = patchedHost();
    const bytes = new ArrayBuffer(4);

    new FontFace('Roboto', 'url(/media/roboto.woff2), url(/media/roboto.woff)');
    new FontFace('Bytes', bytes);
    new FontFace('Only', 'url(https://esm.sh/only.woff2)');

    expect(sources).toEqual([
      'url(/media/roboto.woff2), url(/media/roboto.woff)',
      bytes,
      'url(https://esm.sh/only.woff2)',
    ]);
  });

  it('patches once and does nothing without FontFace (jsdom)', () => {
    const host: FontFaceHost = {
      FontFace: RecordingFontFace,
    };
    selfHostFonts(host);
    const once = host.FontFace;
    selfHostFonts(host);
    const none: FontFaceHost = {};
    selfHostFonts(none);

    expect(host.FontFace).toBe(once);
    expect(host.FontFace).not.toBe(RecordingFontFace);
    expect(none.FontFace).toBeUndefined();
  });
});
