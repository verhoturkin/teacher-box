import { translations } from '@core/i18n/language';

/** Texts of «Проверить» (here, not in `CORE_T`: only the lazily loaded address field needs them). */
const ru = {
  check: 'Проверить',
  opens: 'Открывается — ссылки в приглашениях будут вести сюда.',
  fails:
    'С этого устройства портал по этому адресу не открылся. Проверьте адрес и настройки домена.',
};

const en: typeof ru = {
  check: 'Check',
  opens: 'The portal opens here, so invitation links will use this address.',
  fails:
    'The portal did not open at this address from this device. Check the address and the domain settings.',
};

export const CHECK_T = translations({ ru, en });
