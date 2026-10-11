/**
 * Checks a translation against the Russian dictionary at run time (ADR-0035): the same keys, no empty
 * text, and every function gives a text for sample arguments — so the dictionaries of the languages the
 * tests do not render are covered too.
 */
export function expectComplete(ru: object, other: object, path = ''): void {
  expect(Object.keys(other).sort(), path).toEqual(Object.keys(ru).sort());
  for (const [key, value] of Object.entries(ru)) {
    const source: unknown = value;
    const where = path === '' ? key : `${path}.${key}`;
    const translated: unknown = Reflect.get(other, key);
    expectText(source, where);
    expectText(translated, where);
    if (Array.isArray(source)) {
      expect(Array.isArray(translated) ? translated.length : -1, where).toBe(source.length);
    } else if (typeof source === 'object' && source !== null) {
      if (typeof translated !== 'object' || translated === null) {
        throw new Error(`${where}: not a dictionary`);
      }
      expectComplete(source, translated, where);
    }
  }
}

function expectText(value: unknown, where: string): void {
  if (typeof value === 'string') {
    expect(value.trim(), where).not.toBe('');
  } else if (typeof value === 'function') {
    const text: unknown = Reflect.apply(
      value,
      undefined,
      Array.from({ length: value.length }, () => 2),
    );
    expect(typeof text === 'string' ? text.trim() : '', where).not.toBe('');
  } else if (Array.isArray(value)) {
    for (const item of value) {
      expectText(item, where);
    }
  }
}
