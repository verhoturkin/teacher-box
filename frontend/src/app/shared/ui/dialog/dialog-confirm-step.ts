import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { Button } from 'primeng/button';
import { SHARED_T } from '@shared/i18n/texts';

/**
 * The question inside a dialog (ADR-0050): the text and its own two buttons stand in place of the
 * footer, so that no dialog opens over a dialog. Used by `<tb-dialog>` for a dirty form and by
 * `alert` and `sheet` dialogs for what they confirm («Удалить?», «Сбросить?»).
 */
@Component({
  selector: 'tb-dialog-confirm-step',
  imports: [Button],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p class="tb-d__step-message" role="alert">{{ message() }}</p>
    <div class="tb-d__step-actions">
      <p-button
        [label]="cancelLabel() ?? c.cancel"
        severity="secondary"
        [text]="true"
        (onClick)="cancelled.emit()"
      />
      <p-button
        [label]="confirmLabel()"
        [severity]="severity() === 'danger' ? 'danger' : 'primary'"
        (onClick)="confirmed.emit()"
      />
    </div>
  `,
  host: { class: 'tb-d__step' },
})
export class DialogConfirmStep {
  protected readonly c = SHARED_T.common;

  readonly message = input.required<string>();
  readonly confirmLabel = input.required<string>();
  readonly cancelLabel = input<string | null>(null);
  readonly severity = input<'primary' | 'danger'>('danger');

  readonly confirmed = output();
  readonly cancelled = output();
}
