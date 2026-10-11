import { TestBed } from '@angular/core/testing';
import { buttonByText, hostElement } from '@testing/dom';
import { LANGUAGE_KEY, forgetLanguage, pageReload } from './language';
import { LanguagePicker } from './language-picker';

describe('LanguagePicker', () => {
  afterEach(() => {
    localStorage.removeItem(LANGUAGE_KEY);
    forgetLanguage();
    vi.restoreAllMocks();
  });

  it('offers every language in its own name and switches to it', async () => {
    const reload = vi.spyOn(pageReload, 'now').mockImplementation(() => undefined);
    const fixture = TestBed.createComponent(LanguagePicker);
    await fixture.whenStable();
    const host = hostElement(fixture);

    expect(buttonByText(host, 'Русский').getAttribute('aria-pressed')).toBe('true');
    const english = buttonByText(host, 'English');
    expect(english.getAttribute('lang')).toBe('en');
    expect(english.getAttribute('aria-pressed')).toBe('false');

    english.click();
    expect(localStorage.getItem(LANGUAGE_KEY)).toBe('en');
    expect(reload).toHaveBeenCalledOnce();
  });
});
