import { ChangeDetectionStrategy, Component, output } from '@angular/core';
import { Card } from 'primeng/card';
import { ChangePasswordForm } from '@features/identity/parts';
import { T } from '@features/settings/i18n/texts';

/** The own password, while the generated one is in force; changing it moves on. */
@Component({
  selector: 'tb-setup-password-step',
  imports: [Card, ChangePasswordForm],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: contents' },
  template: `
    <p-card styleClass="tb-section-card tb-section-card--flow">
      <tb-change-password-form
        [currentLabel]="t.currentPassword"
        [submitLabel]="t.next"
        (changed)="changed.emit()"
      />
    </p-card>
  `,
})
export class SetupPasswordStep {
  protected readonly t = T.setup;
  readonly changed = output();
}
