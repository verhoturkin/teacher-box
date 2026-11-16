import { Confirmation } from 'primeng/api';
import { SHARED_T } from '@shared/i18n/texts';

/** Closing a dialog without a consequence: one word, a neutral text button (ADR-0026). */
const REJECT_LABEL = SHARED_T.common.cancel;

/** The warning sign of every danger confirmation (DA-082): the same dialogs look the same. */
const DANGER_ICON = 'tb-i tb-i-warning';

/** A confirmation whose rejection (and the icon) is fixed: «Отмена», a neutral text button. */
export type ConfirmationRequest = Omit<Confirmation, 'rejectLabel' | 'rejectButtonProps' | 'icon'>;

/**
 * A confirmation of an irreversible action (ADR-0019, ADR-0026): the action is a filled red button,
 * «Отмена» a neutral text one, so that the dialog has one red button; the ⚠ sign is always there.
 */
export function dangerConfirmation(confirmation: ConfirmationRequest): Confirmation {
  return {
    ...confirmation,
    icon: DANGER_ICON,
    rejectLabel: REJECT_LABEL,
    acceptButtonProps: { severity: 'danger' },
    rejectButtonProps: { severity: 'secondary', text: true },
  };
}

/**
 * A confirmation of an ordinary action (ADR-0045): the action is a filled primary button, «Отмена» a
 * neutral text one.
 */
export function safeConfirmation(confirmation: ConfirmationRequest): Confirmation {
  return {
    ...confirmation,
    rejectLabel: REJECT_LABEL,
    acceptButtonProps: { severity: 'primary' },
    rejectButtonProps: { severity: 'secondary', text: true },
  };
}
