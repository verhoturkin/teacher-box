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
import { IdentityApi } from '../data-access/identity-api';
import { CreatedStudent, Student, StudentProfileInput } from '../data-access/identity.models';

/** Creates a student (when `student` is null) or edits an existing one. */
@Component({
  selector: 'tb-student-form-dialog',
  imports: [ReactiveFormsModule, Button, Dialog, InputText, Message, Textarea],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-dialog [header]="title()" [(visible)]="visible" [modal]="true" [style]="{ width: '32rem' }" [draggable]="false">
      <form class="tb-form" [formGroup]="form" (ngSubmit)="save()">
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
        @if (error(); as message) {
          <p-message severity="error" styleClass="tb-form-message">{{ message }}</p-message>
        }
      </form>
      <ng-template #footer>
        <p-button label="Отмена" severity="secondary" [text]="true" (onClick)="visible.set(false)" />
        <p-button label="Сохранить" [loading]="pending()" [disabled]="form.invalid" (onClick)="save()" />
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

  protected readonly title = computed(() => (this.student() === null ? 'Новый ученик' : 'Редактирование'));
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
    if (this.form.invalid || this.pending()) {
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
