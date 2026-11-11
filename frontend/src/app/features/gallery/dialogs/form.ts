import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { TbDialog } from '@shared/ui/dialog/dialog';
import { FieldErrors, revealErrors } from '@shared/ui/field-errors';

/**
 * §11 `tb-dialog kind="form"`: two fields or more; full-screen on compact, basic from medium. `formId` ties
 * the confirm button to the form (Enter submits); `[dirty]` asks «Discard changes?» on closing.
 */
@Component({
  selector: 'tb-gallery-form-dialog',
  imports: [ReactiveFormsModule, ButtonModule, InputText, TbDialog, FieldErrors],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-button label="Open a form" severity="secondary" (onClick)="open.set(true)" />
    <code class="tb-gallery-name"
      >tb-dialog kind="form" formId [dirty] — form[id][tbFieldErrors]</code
    >
    <tb-dialog
      kind="form"
      [(visible)]="open"
      headline="New student"
      confirmLabel="Create"
      formId="gallery-student"
      [dirty]="form.dirty"
    >
      <form
        id="gallery-student"
        tbFieldErrors
        class="tb-form"
        [formGroup]="form"
        (ngSubmit)="save()"
      >
        <div class="tb-field">
          <label for="gallery-student-name">Name</label>
          <input pInputText id="gallery-student-name" formControlName="name" />
        </div>
        <div class="tb-field">
          <label for="gallery-student-subject">Subject</label>
          <input pInputText id="gallery-student-subject" formControlName="subject" />
        </div>
      </form>
    </tb-dialog>
  `,
})
export class FormDialogSample {
  protected readonly open = signal(false);
  protected readonly form = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    subject: new FormControl('', { nonNullable: true }),
  });

  protected save(): void {
    if (revealErrors(this.form)) {
      this.form.reset();
      this.open.set(false);
    }
  }
}
