import { ChangeDetectionStrategy, Component, inject, model, output } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { InputText } from 'primeng/inputtext';
import { SegmentGroup, Segment } from '@shared/ui/segment-group';
import { TbDialog } from '@shared/ui/dialog/dialog';
import { dialogSubmit } from '@shared/ui/dialog/dialog-submit';
import { FieldErrors } from '@shared/ui/field-errors';
import { IdentityApi } from '../data-access/identity-api';
import { CreatedStudent } from '../data-access/identity.models';
import { T } from '../i18n/texts';
import { SHARED_T } from '@shared/i18n/texts';

/**
 * Creates a student: the name and a contact (redesign spec §8). The rest of the profile — the note, the
 * default topic, the colour, the price, the video meeting — is filled in on the Профиль tab of the card,
 * which the page opens after this dialog.
 */
@Component({
  selector: 'tb-student-form-dialog',
  imports: [ReactiveFormsModule, TbDialog, InputText, FieldErrors, SegmentGroup],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <tb-dialog
      kind="form"
      [(visible)]="visible"
      [headline]="t.newStudent"
      [confirmLabel]="c.save"
      formId="student-form"
      [pending]="submit.pending()"
      [error]="submit.error()"
      [dirty]="submit.dirty()"
    >
      <form
        tbFieldErrors
        id="student-form"
        class="tb-form"
        [formGroup]="form"
        (ngSubmit)="submit.run()"
      >
        <tb-segment-group
          [label]="t.createKind"
          [segments]="kinds"
          [value]="'student'"
          (valueChange)="choose($event)"
        />
        <div class="tb-field">
          <label for="displayName">{{ t.name }}</label>
          <input
            pInputText
            id="displayName"
            formControlName="displayName"
            autocomplete="off"
            placeholder=" "
          />
        </div>
        <div class="tb-field">
          <label for="email">{{ t.email }}</label>
          <input
            pInputText
            id="email"
            type="email"
            formControlName="email"
            autocomplete="off"
            placeholder=" "
          />
        </div>
        <div class="tb-field">
          <label for="phone">{{ t.phone }}</label>
          <input pInputText id="phone" formControlName="phone" autocomplete="off" placeholder=" " />
        </div>
      </form>
    </tb-dialog>
  `,
})
export class StudentFormDialog {
  protected readonly c = SHARED_T.common;
  protected readonly t = T.studentForm;
  private readonly api = inject(IdentityApi);

  readonly visible = model(false);
  readonly created = output<CreatedStudent>();
  readonly createGroup = output();
  protected readonly kinds: Segment<string>[] = [
    { value: 'student', label: T.studentForm.student },
    { value: 'group', label: T.studentForm.group },
  ];
  protected choose(kind: string): void {
    if (kind === 'group') {
      this.visible.set(false);
      this.createGroup.emit();
    }
  }

  protected readonly form = inject(NonNullableFormBuilder).group({
    displayName: ['', [Validators.required, Validators.maxLength(100)]],
    email: ['', [Validators.email, Validators.maxLength(254)]],
    phone: ['', [Validators.maxLength(32)]],
  });

  protected readonly submit = dialogSubmit({
    visible: this.visible,
    form: this.form,
    failed: T.studentForm.failed,
    request: (value) =>
      this.api.createStudent({
        displayName: value.displayName,
        email: value.email === '' ? null : value.email,
        phone: value.phone === '' ? null : value.phone,
        note: null,
        defaultTopic: null,
        color: null,
      }),
    done: (created) => {
      this.created.emit(created);
    },
  });
}
