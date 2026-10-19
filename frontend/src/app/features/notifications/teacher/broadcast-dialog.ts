import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  model,
  output,
  signal,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Button } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { MultiSelect } from 'primeng/multiselect';
import { Textarea } from 'primeng/textarea';
import { describeError } from '@core/http/error-messages';
import { ChipColors, GroupPicker } from '@features/identity/parts';
import { NotificationsApi } from '../data-access/notifications-api';
import { FieldErrors, revealErrors } from '@shared/ui/field-errors';
import { SubmitFor } from '@shared/ui/submit-for';
import { T } from '../i18n/texts';
import { SHARED_T } from '@shared/i18n/texts';

/** A student the teacher can write to. */
export interface Recipient {
  readonly id: string;
  readonly displayName: string;
}

/** The teacher writes a message to chosen students or to everybody. */
@Component({
  selector: 'tb-broadcast-dialog',
  imports: [
    ReactiveFormsModule,
    Button,
    Dialog,
    GroupPicker,
    InputText,
    Message,
    MultiSelect,
    ChipColors,
    Textarea,
    FieldErrors,
    SubmitFor,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-dialog
      [header]="t.title"
      [(visible)]="visible"
      [modal]="true"
      styleClass="tb-dialog tb-dialog--wide"
      [draggable]="false"
    >
      <form
        tbFieldErrors
        id="broadcast-form"
        class="tb-form"
        [formGroup]="form"
        (ngSubmit)="send()"
      >
        <div class="tb-field">
          <label for="broadcast-students">{{ t.to }}</label>
          <p-multiselect
            inputId="broadcast-students"
            formControlName="studentIds"
            [options]="students()"
            optionLabel="displayName"
            optionValue="id"
            [placeholder]="t.everyone"
            [filter]="true"
            [filterPlaceHolder]="t.search"
            [ariaFilterLabel]="t.search"
            display="chip"
            tbChipColors="student"
            appendTo="body"
            [fluid]="true"
          />
          <small class="tb-hint">{{ t.hint }}</small>
        </div>
        @if (visible()) {
          <tb-group-picker
            inputId="broadcast-group"
            (picked)="addStudents($event)"
            (dropped)="removeStudents($event)"
          />
        }
        <div class="tb-field">
          <label for="broadcast-title">{{ t.subject }}</label>
          <input pInputText id="broadcast-title" formControlName="title" autocomplete="off" />
        </div>
        <div class="tb-field">
          <label for="broadcast-body">{{ t.text }}</label>
          <textarea pTextarea id="broadcast-body" formControlName="body" rows="6"></textarea>
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
        <p-button
          [label]="t.send"
          icon="tb-i tb-i-send"
          [loading]="pending()"
          type="submit"
          tbSubmitFor="broadcast-form"
        />
      </ng-template>
    </p-dialog>
  `,
})
export class BroadcastDialog {
  protected readonly c = SHARED_T.common;
  protected readonly t = T.broadcast;
  private readonly api = inject(NotificationsApi);

  readonly visible = model(false);
  readonly students = input<Recipient[]>([]);
  /** Emits the number of recipients. */
  readonly sent = output<number>();

  protected readonly pending = signal(false);
  protected readonly error = signal<string | null>(null);

  readonly form = new FormGroup({
    studentIds: new FormControl<string[]>([], { nonNullable: true }),
    title: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(300)],
    }),
    body: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(4000)] }),
  });

  constructor() {
    effect(() => {
      if (this.visible()) {
        this.error.set(null);
        this.form.reset();
      }
    });
  }

  /** Adds the students of a chosen group. */
  addStudents(ids: readonly string[]): void {
    const control = this.form.controls.studentIds;
    const known = new Set(this.students().map((student) => student.id));
    control.setValue([...new Set([...control.value, ...ids.filter((id) => known.has(id))])]);
  }

  /** Takes off the students of a group taken off. */
  removeStudents(ids: readonly string[]): void {
    const control = this.form.controls.studentIds;
    const gone = new Set(ids);
    control.setValue(control.value.filter((id) => !gone.has(id)));
  }

  send(): void {
    if (!revealErrors(this.form) || this.pending()) {
      return;
    }
    const value = this.form.getRawValue();
    this.pending.set(true);
    this.error.set(null);
    this.api
      .broadcast({
        title: value.title.trim(),
        body: value.body.trim() === '' ? null : value.body.trim(),
        studentIds: value.studentIds,
      })
      .subscribe({
        next: (recipients) => {
          this.pending.set(false);
          this.visible.set(false);
          this.sent.emit(recipients);
        },
        error: (error: unknown) => {
          this.pending.set(false);
          this.error.set(describeError(error, T.broadcast.failed));
        },
      });
  }
}
