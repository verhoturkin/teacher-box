import { Directive, TemplateRef, inject } from '@angular/core';

/** What the account gives the slot: whether the account is the teacher's. */
interface AccountNotificationsContext {
  readonly $implicit: boolean;
}

/**
 * The slot of «Уведомления» in the account panel: the page that shows the panel puts the section
 * of the notifications feature here, so `identity` does not import it (ADR-0058):
 * `<ng-template tbAccountNotifications let-teacher>…</ng-template>`. The panel renders it for the
 * teacher and a student, where the layout of the screen size has the section.
 */
@Directive({ selector: 'ng-template[tbAccountNotifications]' })
export class AccountNotifications {
  readonly template = inject<TemplateRef<AccountNotificationsContext>>(TemplateRef);

  static ngTemplateContextGuard(
    _directive: AccountNotifications,
    context: unknown,
  ): context is AccountNotificationsContext {
    return context !== null;
  }
}
