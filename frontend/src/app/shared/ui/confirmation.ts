import { Confirmation } from 'primeng/api';

/**
 * A confirmation of an irreversible action (ADR-0019): the action is a filled red button, «Назад»
 * a neutral text one, so that the dialog has one red button.
 */
export function dangerConfirmation(confirmation: Confirmation): Confirmation {
  return {
    rejectLabel: 'Назад',
    ...confirmation,
    acceptButtonProps: { severity: 'danger' },
    rejectButtonProps: { severity: 'secondary', text: true },
  };
}

/**
 * A confirmation of an ordinary action (ADR-0019): the action confirms (green), «Отмена» cancels
 * (red text).
 */
export function safeConfirmation(confirmation: Confirmation): Confirmation {
  return {
    rejectLabel: 'Отмена',
    ...confirmation,
    acceptButtonProps: { severity: 'success' },
    rejectButtonProps: { severity: 'danger', text: true },
  };
}
