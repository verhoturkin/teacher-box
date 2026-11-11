import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { DialogFooter, TbDialog } from '@shared/ui/dialog/dialog';
import { SubmitFor } from '@shared/ui/submit-for';

/**
 * §11 A wizard: `ng-template tbDialogFooter` replaces the standard footer (rare); its submit button sits outside
 * the form, so `tbSubmitFor` ties it to the form and Enter in a field submits.
 */
@Component({
  selector: 'tb-gallery-wizard-dialog',
  imports: [ReactiveFormsModule, ButtonModule, InputText, TbDialog, DialogFooter, SubmitFor],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-button label="Open a wizard" severity="secondary" (onClick)="open.set(true)" />
    <code class="tb-gallery-name"
      >ng-template tbDialogFooter > p-button type="submit" tbSubmitFor="form-id"</code
    >
    <tb-dialog kind="form" [(visible)]="open" [headline]="'Connection · step ' + step()">
      <ng-template tbDialogFooter>
        @if (step() === 2) {
          <p-button label="Back" severity="secondary" [text]="true" (onClick)="step.set(1)" />
        }
        <p-button
          type="submit"
          tbSubmitFor="gallery-wizard"
          [label]="step() === 1 ? 'Next' : 'Connect'"
        />
      </ng-template>
      <form id="gallery-wizard" class="tb-form" [formGroup]="form" (ngSubmit)="next()">
        <div class="tb-field">
          <label for="gallery-wizard-key">{{ step() === 1 ? 'API key' : 'Model' }}</label>
          <input
            pInputText
            id="gallery-wizard-key"
            [formControlName]="step() === 1 ? 'key' : 'model'"
          />
        </div>
      </form>
    </tb-dialog>
  `,
})
export class WizardDialogSample {
  protected readonly open = signal(false);
  protected readonly step = signal<1 | 2>(1);
  protected readonly form = new FormGroup({
    key: new FormControl('', { nonNullable: true }),
    model: new FormControl('', { nonNullable: true }),
  });

  protected next(): void {
    if (this.step() === 1) {
      this.step.set(2);
    } else {
      this.open.set(false);
      this.step.set(1);
    }
  }
}
