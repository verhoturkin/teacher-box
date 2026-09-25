import { AccountStatus, InvitePurpose } from '../data-access/identity.models';

export type TagSeverity = 'success' | 'warn' | 'secondary';

export const STATUS_LABELS: Readonly<Record<AccountStatus, string>> = {
  INVITED: 'Приглашён',
  ACTIVE: 'Активен',
  DEACTIVATED: 'Отключён',
};

export const STATUS_SEVERITIES: Readonly<Record<AccountStatus, TagSeverity>> = {
  INVITED: 'warn',
  ACTIVE: 'success',
  DEACTIVATED: 'secondary',
};

export const INVITE_PURPOSE_LABELS: Readonly<Record<InvitePurpose, string>> = {
  ACTIVATION: 'Приглашение',
  PASSWORD_RESET: 'Сброс пароля',
};
