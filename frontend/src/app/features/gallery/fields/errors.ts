import { ChangeDetectionStrategy, Component } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { FieldErrors, revealErrors } from '@shared/ui/field-errors';

/**
 * §9 Required fields and errors: `<form tbFieldErrors>` marks required fields (`*`, `aria-required`) and shows
 * the error under the field; a submit with errors shows them all and focuses the first (`revealErrors`).
 */
@Component({
  selector: 'tb-gallery-field-errors',
  imports: [ReactiveFormsModule, ButtonModule, InputText, FieldErrors],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form tbFieldErrors class="tb-form tb-form--narrow" [formGroup]="form" (ngSubmit)="submit()">
      <div class="tb-field">
        <label for="gallery-login">Login</label>
        <input pInputText id="gallery-login" formControlName="login" />
      </div>
      <div class="tb-field">
        <label for="gallery-email">Email</label>
        <input pInputText id="gallery-email" formControlName="email" />
      </div>
      <div class="tb-actions">
        <p-button type="submit" label="Check" />
      </div>
      <code class="tb-gallery-name"
        >form[tbFieldErrors] + Validators; submit → revealErrors(form)</code
      >
    </form>
  `,
})
export class FieldErrorsSample {
  protected readonly form = new FormGroup({
    login: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    email: new FormControl('anna@', { nonNullable: true, validators: [Validators.email] }),
  });

  protected submit(): void {
    revealErrors(this.form);
  }
}
