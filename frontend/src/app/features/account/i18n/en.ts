import type { Translation } from '@core/i18n/language';
import type { ru } from './ru';

export const en: Translation<typeof ru> = {
  account: {
    title: 'My account',
    savedAtOnce: 'Changes are saved straight away',
  },
};
