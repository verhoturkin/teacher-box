import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  model,
  output,
  signal,
  untracked,
} from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Button } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { SegmentGroup, Segment } from '@shared/ui/segment-group';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { describeError } from '@core/http/error-messages';
import { IdentityApi } from '../data-access/identity-api';
import { CreatedStudent } from '../data-access/identity.models';
import { FieldErrors, revealErrors } from '@shared/ui/field-errors';
import { SubmitFor } from '@shared/ui/submit-for';
import { T } from '../i18n/texts';
import { SHARED_T } from '@shared/i18n/texts';

/**
 * Creates a student: the name and a contact (redesign spec §8). The rest of the profile — the note, the
 * default topic, the colour, the price, the video meeting — is filled in on the Профиль tab of the card,
 * which the page opens after this dialog.
 */
@Component({
  selector: 'tb-student-form-dialog',
  imports: [
    ReactiveFormsModule,
    Button,
    Dialog,
    InputText,
    Message,
    FieldErrors,
    SubmitFor,
    SegmentGroup,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './student-filled-fields.scss',
  template: `
    <p-dialog
      [header]="t.newStudent"
      [(visible)]="visible"
      [modal]="true"
      styleClass="tb-dialog"
      [draggable]="false"
    >
      <form tbFieldErrors id="student-form" class="tb-form" [formGroup]="form" (ngSubmit)="save()">
        <tb-segment-group
          [label]="t.createKind"
          [segments]="kinds"
          [value]="'student'"
          (valueChange)="choose($event)"
        />
        <div class="tb-field tb-field--filled">
          <label for="displayName">{{ t.name }}</label>
          <input
            pInputText
            id="displayName"
            formControlName="displayName"
            autocomplete="off"
            placeholder=" "
          />
        </div>
        <div class="tb-field tb-field--filled">
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
        <div class="tb-field tb-field--filled">
          <label for="phone">{{ t.phone }}</label>
          <input pInputText id="phone" formControlName="phone" autocomplete="off" placeholder=" " />
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
        <p-button [label]="c.save" [loading]="pending()" type="submit" tbSubmitFor="student-form" />
      </ng-template>
    </p-dialog>
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

  protected readonly pending = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly form = inject(NonNullableFormBuilder).group({
    displayName: ['', [Validators.required, Validators.maxLength(100)]],
    email: ['', [Validators.email, Validators.maxLength(254)]],
    phone: ['', [Validators.maxLength(32)]],
  });

  constructor() {
    // an empty form whenever the dialog opens
    effect(() => {
      if (this.visible()) {
        untracked(() => {
          this.error.set(null);
          this.form.reset();
        });
      }
    });
  }

  protected save(): void {
    if (!revealErrors(this.form) || this.pending()) {
      return;
    }
    const value = this.form.getRawValue();
    this.pending.set(true);
    this.error.set(null);
    this.api
      .createStudent({
        displayName: value.displayName,
        email: value.email === '' ? null : value.email,
        phone: value.phone === '' ? null : value.phone,
        note: null,
        defaultTopic: null,
        color: null,
      })
      .subscribe({
        next: (created) => {
          this.pending.set(false);
          this.visible.set(false);
          this.created.emit(created);
        },
        error: (error: unknown) => {
          this.pending.set(false);
          this.error.set(describeError(error, T.studentForm.failed));
        },
      });
  }
}
