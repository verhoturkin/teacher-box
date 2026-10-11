import { readDeviceSetting, writeDeviceSetting } from '@shared/storage/device-settings';

/**
 * The languages of the interface (ADR-0035). A new language: a row here, then the compiler names every
 * dictionary (`translations({ ru, en, … })`) that still lacks it.
 */
export const LANGUAGES = [
  { code: 'ru', name: 'Русский', locale: 'ru-RU' },
  { code: 'en', name: 'English', locale: 'en-GB' },
] as const;

export type Language = (typeof LANGUAGES)[number]['code'];

/** Device setting with the chosen language. */
export const LANGUAGE_KEY = 'tb.language';

/** The texts are written in it; the others are translations of its dictionaries. */
const SOURCE = 'ru' satisfies Language;

function isLanguage(value: string | null): value is Language {
  return LANGUAGES.some((known) => known.code === value);
}

let current: Language | undefined;

/**
 * The language of this page: chosen once, when the first text is needed; another choice reloads the
 * page, so labels computed when a module loads stay right.
 */
export function language(): Language {
  current ??= stored();
  return current;
}

/** The locale of numbers, dates and money in the current language, e.g. `ru-RU`. */
export function locale(): string {
  const code = language();
  return LANGUAGES.find((known) => known.code === code)?.locale ?? 'ru-RU';
}

/** Reloads the page (replaced in tests: jsdom does not navigate). */
export const pageReload = {
  now(): void {
    location.reload();
  },
};

/** Keeps the choice on this device and reloads the page in the new language. */
export function chooseLanguage(code: Language): void {
  writeDeviceSetting(LANGUAGE_KEY, code);
  if (code !== language()) {
    pageReload.now();
  }
}

/** Tests only: the next {@link language} reads the device setting again. */
export function forgetLanguage(): void {
  current = undefined;
}

function stored(): Language {
  const value = readDeviceSetting(LANGUAGE_KEY);
  return isLanguage(value) ? value : SOURCE;
}

/**
 * A dictionary in another language with the shape of the Russian one: the same keys, strings for strings,
 * functions with the same parameters for functions (numbers and names inside a text).
 */
export type Translation<T> = {
  readonly [K in keyof T]: T[K] extends string
    ? string
    : T[K] extends (...args: infer A) => string
      ? (...args: A) => string
      : T[K] extends readonly string[]
        ? readonly string[]
        : Translation<T[K]>;
};

type Dictionaries<T> = Readonly<Record<typeof SOURCE, T>> &
  Readonly<Record<Exclude<Language, typeof SOURCE>, Translation<T>>>;

/**
 * The dictionary of the current language: `translations({ ru, en })`. The Russian dictionary is the source;
 * a missing or extra key in another one is a compile error. Each section is taken from the language of the
 * moment it is read (a component reads its section when it is created), so the dictionaries do not depend
 * on the order in which modules load.
 */
export function translations<T extends object>(dictionaries: Dictionaries<T>): Translation<T>;
export function translations(dictionaries: Readonly<Record<Language, object>>): object {
  return new Proxy(dictionaries[SOURCE], {
    get: (_source, key): unknown => Reflect.get(dictionaries[language()], key),
  });
}
