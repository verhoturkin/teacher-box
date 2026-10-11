import {
  LANGUAGE_KEY,
  chooseLanguage,
  forgetLanguage,
  language,
  locale,
  pageReload,
  translations,
} from './language';

describe('language', () => {
  const dictionaries = { ru: { hello: 'Привет' }, en: { hello: 'Hello' } };

  function stored(code: string): void {
    localStorage.setItem(LANGUAGE_KEY, code);
    forgetLanguage();
  }

  afterEach(() => {
    localStorage.removeItem(LANGUAGE_KEY);
    forgetLanguage();
    vi.restoreAllMocks();
  });

  it('is Russian unless another known language is chosen on this device', () => {
    forgetLanguage();
    expect(language()).toBe('ru');
    expect(locale()).toBe('ru-RU');
    expect(translations(dictionaries).hello).toBe('Привет');

    stored('en');
    expect(language()).toBe('en');
    expect(locale()).toBe('en-GB');
    expect(translations(dictionaries).hello).toBe('Hello');

    stored('xx');
    expect(language()).toBe('ru');
  });

  it('keeps the choice and reloads the page only for another language', () => {
    const reload = vi.spyOn(pageReload, 'now').mockImplementation(() => undefined);
    forgetLanguage();

    chooseLanguage('ru');
    expect(reload).not.toHaveBeenCalled();

    chooseLanguage('en');
    expect(localStorage.getItem(LANGUAGE_KEY)).toBe('en');
    expect(reload).toHaveBeenCalledOnce();
  });
});
