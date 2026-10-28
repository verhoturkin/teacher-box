const BROWSERS: readonly (readonly [RegExp, string])[] = [
  [/Edg\//, 'Edge'],
  [/OPR\/|Opera/, 'Opera'],
  [/YaBrowser/, 'Яндекс Браузер'],
  [/Firefox|FxiOS/, 'Firefox'],
  [/Chrome|CriOS/, 'Chrome'],
  [/Safari/, 'Safari'],
];

// iPhone and iPad first: their user agent also says «like Mac OS X».
const SYSTEMS: readonly (readonly [RegExp, string])[] = [
  [/iPhone/, 'iPhone'],
  [/iPad/, 'iPad'],
  [/Android/, 'Android'],
  [/Windows/, 'Windows'],
  [/Mac OS X|Macintosh/, 'macOS'],
  [/Linux/, 'Linux'],
];

/** «Chrome · Android» out of a User-Agent; the names are brands, so they are not translated. */
export function deviceName(userAgent: string | null, fallback: string): string {
  const agent = userAgent ?? '';
  const parts = [BROWSERS, SYSTEMS].flatMap(
    (known) => known.find(([pattern]) => pattern.test(agent))?.[1] ?? [],
  );
  return parts.length === 0 ? fallback : parts.join(' · ');
}
