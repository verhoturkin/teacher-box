import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  model,
  output,
  signal,
} from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Button } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { MultiSelect } from 'primeng/multiselect';
import { describeError } from '@core/http/error-messages';
import { ChipColors } from '../colors/chip-colors';
import { IdentityApi } from '../data-access/identity-api';
import { Student, StudentGroup } from '../data-access/identity.models';
import { FieldErrors, revealErrors } from '@shared/ui/field-errors';
import { SubmitFor } from '@shared/ui/submit-for';
import { T } from '../i18n/texts';
import { SHARED_T } from '@shared/i18n/texts';

/**
 * Creates a group: its name and the students in it. The rest — the price, the default topic, the colour, the
 * room — is on the Профиль tab of the group's card, which the page opens next (redesign spec §8).
 */
@Component({
  selector: 'tb-group-form-dialog',
  imports: [
    ReactiveFormsModule,
    Button,
    Dialog,
    InputText,
    Message,
    MultiSelect,
    FieldErrors,
    SubmitFor,
    ChipColors,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-dialog
      [header]="t.newGroup"
      [(visible)]="visible"
      [modal]="true"
      styleClass="tb-dialog"
      [draggable]="false"
    >
      <form tbFieldErrors id="group-form" class="tb-form" [formGroup]="form" (ngSubmit)="save()">
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
        @if (error(); as message) {
          <p-message severity="error" styleClass="tb-form-message">{{ message }}</p-message>
        }
      </form>
      <ng-template #footer>
        <p-button
          [label]="c.cancel"
          severity="secondary"
          [text]="true"
          (onClick)="visible.set(false)"
        />
        <p-button [label]="t.create" [loading]="pending()" type="submit" tbSubmitFor="group-form" />
      </ng-template>
    </p-dialog>
  `,
})
export class GroupFormDialog {
  protected readonly c = SHARED_T.common;
  protected readonly t = T.groupForm;
  private readonly api = inject(IdentityApi);

  readonly visible = model(false);
  /** Students that can join (deactivated ones are skipped). */
  readonly students = input<readonly Student[]>([]);
  readonly created = output<StudentGroup>();

  protected readonly pending = signal(false);
  protected readonly error = signal<string | null>(null);
  readonly memberOptions = computed(() =>
    this.students().filter((student) => student.status !== 'DEACTIVATED'),
  );

  readonly form = inject(NonNullableFormBuilder).group({
    name: ['', [Validators.required, Validators.maxLength(100)]],
    memberIds: [[] as string[]],
  });

  constructor() {
    effect(() => {
      if (this.visible()) {
        this.error.set(null);
        this.form.reset({ name: '', memberIds: [] });
      }
    });
  }

  save(): void {
    if (!revealErrors(this.form) || this.pending()) {
      return;
    }
    const value = this.form.getRawValue();
    this.pending.set(true);
    this.error.set(null);
    this.api
      .createGroup({
        name: value.name.trim(),
        memberIds: value.memberIds,
        defaultTopic: null,
        color: null,
      })
      .subscribe({
        next: (group) => {
          this.pending.set(false);
          this.visible.set(false);
          this.created.emit(group);
        },
        error: (error: unknown) => {
          this.pending.set(false);
          this.error.set(describeError(error, T.groupForm.failed));
        },
      });
  }
}
