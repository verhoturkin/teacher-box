import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  model,
  output,
} from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { InputText } from 'primeng/inputtext';
import { MultiSelect } from 'primeng/multiselect';
import { TbDialog } from '@shared/ui/dialog/dialog';
import { dialogSubmit } from '@shared/ui/dialog/dialog-submit';
import { FieldErrors } from '@shared/ui/field-errors';
import { ChipColors } from '../colors/chip-colors';
import { IdentityApi } from '../data-access/identity-api';
import { Student, StudentGroup } from '../data-access/identity.models';
import { T } from '../i18n/texts';

/**
 * Creates a group: its name and the students in it. The rest — the price, the default topic, the colour, the
 * room — is on the Профиль tab of the group's card, which the page opens next (redesign spec §8).
 */
@Component({
  selector: 'tb-group-form-dialog',
  imports: [ReactiveFormsModule, TbDialog, InputText, MultiSelect, FieldErrors, ChipColors],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <tb-dialog
      kind="form"
      [(visible)]="visible"
      [headline]="t.newGroup"
      [confirmLabel]="t.create"
      formId="group-form"
      [pending]="submit.pending()"
      [error]="submit.error()"
      [dirty]="submit.dirty()"
    >
      <form
        tbFieldErrors
        id="group-form"
        class="tb-form"
        [formGroup]="form"
        (ngSubmit)="submit.run()"
      >
        <div class="tb-field">
          <label for="group-name">{{ t.name }}</label>
          <input
            pInputText
            id="group-name"
            formControlName="name"
            autocomplete="off"
            [placeholder]="t.namePlaceholder"
          />
        </div>
        <div class="tb-field">
          <label for="group-members">{{ t.members }}</label>
          <p-multiselect
            inputId="group-members"
            formControlName="memberIds"
            [options]="memberOptions()"
            optionLabel="displayName"
            optionValue="id"
            [placeholder]="t.membersPlaceholder"
            [filter]="true"
            [filterPlaceHolder]="t.search"
            [ariaFilterLabel]="t.search"
            display="chip"
            tbChipColors="student"
            appendTo="body"
            [fluid]="true"
          />
        </div>
      </form>
    </tb-dialog>
  `,
})
export class GroupFormDialog {
  protected readonly t = T.groupForm;
  private readonly api = inject(IdentityApi);

  readonly visible = model(false);
  /** Students that can join (deactivated ones are skipped). */
  readonly students = input<readonly Student[]>([]);
  readonly created = output<StudentGroup>();

  readonly memberOptions = computed(() =>
    this.students().filter((student) => student.status !== 'DEACTIVATED'),
  );

  readonly form = inject(NonNullableFormBuilder).group({
    name: ['', [Validators.required, Validators.maxLength(100)]],
    memberIds: [[] as string[]],
  });

  protected readonly submit = dialogSubmit({
    visible: this.visible,
    form: this.form,
    failed: T.groupForm.failed,
    request: (value) =>
      this.api.createGroup({
        name: value.name.trim(),
        memberIds: value.memberIds,
        defaultTopic: null,
        color: null,
      }),
    done: (group) => {
      this.created.emit(group);
    },
  });
}
