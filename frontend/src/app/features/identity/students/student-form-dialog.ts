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
import { Textarea } from 'primeng/textarea';
import { describeError } from '@core/http/error-messages';
import { RoomOwnerRef, RoomPanel } from '@features/meetings/parts';
import { IdentityApi } from '../data-access/identity-api';
import { CreatedStudent, Student, StudentProfileInput } from '../data-access/identity.models';
import { FieldErrors, revealErrors } from '@shared/ui/field-errors';
import { SubmitFor } from '@shared/ui/submit-for';

/** Creates a student (when `student` is null) or edits an existing one. */
@Component({
  selector: 'tb-student-form-dialog',
  imports: [
    ReactiveFormsModule,
    Button,
    Dialog,
    InputText,
    Message,
    Textarea,
    FieldErrors,
    SubmitFor,
    RoomPanel,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-dialog
      [header]="title()"
      [(visible)]="visible"
      [modal]="true"
      styleClass="tb-dialog"
      [draggable]="false"
    >
      <form tbFieldErrors id="student-form" class="tb-form" [formGroup]="form" (ngSubmit)="save()">
        <div class="tb-field">
          <label for="displayName">Имя и фамилия</label>
          <input pInputText id="displayName" formControlName="displayName" autocomplete="off" />
        </div>
        <div class="tb-field">
          <label for="email">E-mail</label>
          <input pInputText id="email" type="email" formControlName="email" autocomplete="off" />
        </div>
        <div class="tb-field">
          <label for="phone">Телефон</label>
          <input pInputText id="phone" formControlName="phone" autocomplete="off" />
        </div>
        <div class="tb-field">
          <label for="note">Заметка (видна только вам)</label>
          <textarea pTextarea id="note" formControlName="note" rows="3"></textarea>
        </div>
        @if (student(); as student) {
          <div class="tb-field">
            <label for="login">Логин</label>
            <input
              pInputText
              id="login"
              readonly
              [value]="student.login ?? 'Ещё не выбран'"
              aria-describedby="login-hint"
            />
            <small id="login-hint" class="tb-hint"
              >Логин ученик выбирает сам, когда входит по приглашению.</small
            >
          </div>
        }
        @if (error(); as message) {
          <p-message severity="error" styleClass="tb-form-message">{{ message }}</p-message>
        }
      </form>
      <tb-room-panel [owner]="roomOwner()" />
      <ng-template #footer>
        <p-button
          label="Отмена"
          severity="secondary"
          [text]="true"
          (onClick)="visible.set(false)"
        />
        <p-button
          severity="success"
          label="Сохранить"
          [loading]="pending()"
          type="submit"
          tbSubmitFor="student-form"
        />
      </ng-template>
    </p-dialog>
  `,
})
export class StudentFormDialog {
  private readonly api = inject(IdentityApi);

  readonly visible = model(false);
  /** Student to edit; `null` creates a new one. */
  readonly student = input<Student | null>(null);
  readonly created = output<CreatedStudent>();
  readonly updated = output<Student>();

  protected readonly title = computed(() =>
    this.student() === null ? 'Новый ученик' : 'Изменить ученика',
  );
  /** The room is set up for a saved student who still has access. */
  protected readonly roomOwner = computed<RoomOwnerRef | null>(() => {
    const student = this.student();
    return student === null || student.status === 'DEACTIVATED' || !this.visible()
      ? null
      : { type: 'STUDENT', id: student.id, name: student.displayName };
  });
  protected readonly pending = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly form = inject(NonNullableFormBuilder).group({
    displayName: ['', [Validators.required, Validators.maxLength(100)]],
    email: ['', [Validators.email, Validators.maxLength(254)]],
    phone: ['', [Validators.maxLength(32)]],
    note: ['', [Validators.maxLength(2000)]],
  });

  constructor() {
    // Fill the form whenever the dialog opens.
    effect(() => {
      if (this.visible()) {
        const student = this.student();
        this.error.set(null);
        this.form.reset({
          displayName: student?.displayName ?? '',
          email: student?.email ?? '',
          phone: student?.phone ?? '',
          note: student?.note ?? '',
        });
      }
    });
  }

  protected save(): void {
    if (!revealErrors(this.form) || this.pending()) {
      return;
    }
    const value = this.form.getRawValue();
    const profile: StudentProfileInput = {
      displayName: value.displayName,
      email: value.email === '' ? null : value.email,
      phone: value.phone === '' ? null : value.phone,
      note: value.note === '' ? null : value.note,
    };
    const student = this.student();
    this.pending.set(true);
    this.error.set(null);
    const onError = (error: unknown): void => {
      this.pending.set(false);
      this.error.set(describeError(error, 'Не удалось сохранить. Попробуйте позже'));
    };
    if (student === null) {
      this.api.createStudent(profile).subscribe({
        next: (created) => {
          this.finish();
          this.created.emit(created);
        },
        error: onError,
      });
    } else {
      this.api.updateStudent(student.id, profile, student.version).subscribe({
        next: (saved) => {
          this.finish();
          this.updated.emit(saved);
        },
        error: onError,
      });
    }
  }

  private finish(): void {
    this.pending.set(false);
    this.visible.set(false);
  }
}
