import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { InputText } from 'primeng/inputtext';
import { T } from '../i18n/texts';

/** The longest teacher name the server takes. */
export const MAX_TEACHER_NAME_LENGTH = 100;

/** The checks of the teacher's name: given, not only spaces, at most 100 characters. */
export const TEACHER_NAME_VALIDATORS = [
  Validators.required,
  Validators.maxLength(MAX_TEACHER_NAME_LENGTH),
  Validators.pattern(/\S/),
];

/**
 * The teacher's name as students see it (Мой аккаунт › Профиль and the first setup). The host saves on
 * `committed` (the value changed and the field was left) or later.
 */
@Component({
  selector: 'tb-teacher-name-field',
  imports: [ReactiveFormsModule, InputText],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="tb-field">
      <label [for]="inputId()">{{ label() || t.name }}</label>
      <input
        pInputText
        [id]="inputId()"
        [formControl]="control()"
        [maxlength]="maxLength"
        autocomplete="name"
        (change)="committed.emit()"
      />
      <small class="tb-hint">{{ t.teacherNameHint }}</small>
    </div>
  `,
})
export class TeacherNameField {
  readonly control = input.required<FormControl<string>>();
  readonly inputId = input('account-name');
  /** Instead of «Имя» (the first setup asks «Ваше имя»). */
  readonly label = input('');
  readonly committed = output();

  protected readonly t = T.account;
  protected readonly maxLength = MAX_TEACHER_NAME_LENGTH;
}
