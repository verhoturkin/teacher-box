import { Confirmation } from 'primeng/api';

/** Closing a dialog without a consequence: one word, a neutral text button (ADR-0026). */
const REJECT_LABEL = 'Отмена';

/** A confirmation whose rejection is fixed: «Отмена», a neutral text button. */
export type ConfirmationRequest = Omit<Confirmation, 'rejectLabel' | 'rejectButtonProps'>;

/**
 * A confirmation of an irreversible action (ADR-0019, ADR-0026): the action is a filled red button,
 * «Отмена» a neutral text one, so that the dialog has one red button.
 */
export function dangerConfirmation(confirmation: ConfirmationRequest): Confirmation {
  return {
    ...confirmation,
    rejectLabel: REJECT_LABEL,
    acceptButtonProps: { severity: 'danger' },
    rejectButtonProps: { severity: 'secondary', text: true },
  };
}

/**
 * A confirmation of an ordinary action (ADR-0019, ADR-0026): the action confirms (green), «Отмена»
 * is a neutral text button.
 */
export function safeConfirmation(confirmation: ConfirmationRequest): Confirmation {
  return {
    ...confirmation,
    rejectLabel: REJECT_LABEL,
    acceptButtonProps: { severity: 'success' },
    rejectButtonProps: { severity: 'secondary', text: true },
  };
}
