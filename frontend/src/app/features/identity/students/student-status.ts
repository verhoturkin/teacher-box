import { AccountStatus, InvitePurpose } from '../data-access/identity.models';
import { T } from '../i18n/texts';

export type TagSeverity = 'success' | 'warn' | 'secondary';

export const STATUS_LABELS: Readonly<Record<AccountStatus, string>> = T.statuses;

export const STATUS_SEVERITIES: Readonly<Record<AccountStatus, TagSeverity>> = {
  INVITED: 'warn',
  ACTIVE: 'success',
  DEACTIVATED: 'secondary',
};

export const INVITE_PURPOSE_LABELS: Readonly<Record<InvitePurpose, string>> = T.invitePurposes;
