import { languageName } from './caption-language-dialog';

describe('languageName', () => {
  it('names a language in the interface language, a broken code stays as is', () => {
    expect(languageName('en')).toBe('английский');
    expect(languageName('not a code')).toBe('not a code');
  });
});
