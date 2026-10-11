import { expectComplete } from '@testing/i18n';
import { en } from './en';
import { ru } from './ru';

describe('common texts', () => {
  it('are complete in every language', () => {
    expectComplete(ru, en);
  });
});
