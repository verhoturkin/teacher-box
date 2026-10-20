import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  FormControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { Textarea } from 'primeng/textarea';
import { StudentPriceCard } from '@features/billing/parts';
import { RoomOwnerRef, RoomPanel } from '@features/meetings/parts';
import { describeError } from '@core/http/error-messages';
import { LabelColor } from '@core/theme/label-colors';
import { SHARED_T } from '@shared/i18n/texts';
import { FieldErrors, revealErrors } from '@shared/ui/field-errors';
import { LabelColorField } from '../colors/label-color-field';
import { IdentityApi } from '../data-access/identity-api';
import { Student, StudentProfileInput } from '../data-access/identity.models';
import { T } from '../i18n/texts';

/** The profile of a student as the form holds it: empty strings for missing values. */
interface ProfileValue {
  readonly displayName: string;
  readonly email: string;
  readonly phone: string;
  readonly note: string;
  readonly defaultTopic: string;
  readonly color: LabelColor | null;
}

const PROFILE_KEYS: readonly (keyof StudentProfileInput)[] = [
  'displayName',
  'email',
  'phone',
  'note',
  'defaultTopic',
  'color',
];

function valueOf(student: Student): ProfileValue {
  return {
    displayName: student.displayName,
    email: student.email ?? '',
    phone: student.phone ?? '',
    note: student.note ?? '',
    defaultTopic: student.defaultTopic ?? '',
    color: student.color,
  };
}

function inputOf(value: ProfileValue): StudentProfileInput {
  const optional = (text: string): string | null => (text.trim() === '' ? null : text.trim());
  return {
    displayName: value.displayName.trim(),
    email: optional(value.email),
    phone: optional(value.phone),
    note: value.note.trim() === '' ? null : value.note,
    defaultTopic: optional(value.defaultTopic),
    color: value.color,
  };
}

/**
 * The Профиль tab of a student's card (redesign spec §8): what the teacher knows of the student, changed in
 * place — cards one under another: «Данные ученика» (the name, the contacts, the note, the default topic, the
 * colour; the tonal «Сохранить» under the fields saves them, «Отмена» brings back the saved ones), the lesson
 * price, the video meeting and «Вход в кабинет» (the login the student chose, the invitation link).
 */
@Component({
  selector: 'tb-student-profile-tab',
  imports: [
    ReactiveFormsModule,
    Button,
    Card,
    InputText,
    Message,
    Textarea,
    FieldErrors,
    LabelColorField,
    RoomPanel,
    StudentPriceCard,
  ],
  providers: [DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let row = student();
    <div class="tb-student-profile">
      <p-card [header]="t.details">
        <form tbFieldErrors class="tb-form" [formGroup]="form" (ngSubmit)="save()">
          <div class="tb-field tb-field--required">
            <label for="profile-name">{{ f.name }}</label>
            <input
              pInputText
              id="profile-name"
              formControlName="displayName"
              autocomplete="off"
              aria-required="true"
            />
          </div>
          <div class="tb-field">
            <label for="profile-email">{{ f.email }}</label>
            <input
              pInputText
              id="profile-email"
              type="email"
              formControlName="email"
              autocomplete="off"
            />
          </div>
          <div class="tb-field">
            <label for="profile-phone">{{ f.phone }}</label>
            <input pInputText id="profile-phone" formControlName="phone" autocomplete="off" />
          </div>
          <div class="tb-field">
            <label for="profile-note">{{ f.note }}</label>
            <textarea pTextarea id="profile-note" formControlName="note" rows="3"></textarea>
          </div>
          <div class="tb-field">
            <label for="profile-topic">{{ f.defaultTopic }}</label>
            <input
              pInputText
              id="profile-topic"
              formControlName="defaultTopic"
              autocomplete="off"
              [placeholder]="f.defaultTopicPlaceholder"
              aria-describedby="profile-topic-hint"
            />
            <small id="profile-topic-hint" class="tb-hint">{{ f.defaultTopicHint }}</small>
          </div>
          <tb-label-color-field inputId="profile-color" [control]="form.controls.color" />
          @if (error(); as message) {
            <p-message severity="error" styleClass="tb-form-message">{{ message }}</p-message>
          }
          <div class="tb-form-actions">
            @if (changed()) {
              <p-button
                [label]="c.cancel"
                severity="secondary"
                [text]="true"
                (onClick)="cancel()"
              />
            }
            <p-button
              type="submit"
              severity="secondary"
              [label]="c.save"
              icon="tb-i tb-i-check"
              [disabled]="!changed()"
              [loading]="pending()"
            />
          </div>
        </form>
      </p-card>

      <tb-student-price-card [studentId]="row.id" />

      <tb-room-panel [owner]="roomOwner()" [card]="true" />

      <p-card [header]="t.access">
        <div class="tb-form">
          <div class="tb-field">
            <label for="profile-login">{{ f.login }}</label>
            <input
              pInputText
              id="profile-login"
              readonly
              [value]="row.login ?? f.noLogin"
              aria-describedby="profile-login-hint"
            />
            <small id="profile-login-hint" class="tb-hint">{{ f.loginHint }}</small>
          </div>
          @if (accessLine(); as line) {
            <p class="tb-muted">{{ line }}</p>
          }
          @if (row.status !== 'DEACTIVATED') {
            <div class="tb-form-actions">
              <p-button
                [label]="row.status === 'ACTIVE' ? s.resetPassword : s.newInvite"
                icon="tb-i tb-i-link"
                severity="secondary"
                [loading]="busy()"
                (onClick)="invite.emit()"
              />
            </div>
          }
        </div>
      </p-card>
    </div>
  `,
  styles: `
    .tb-student-profile {
      display: flex;
      flex-direction: column;
      gap: var(--tb-space-4);
    }

    p {
      margin: 0;
    }
  `,
})
export class StudentProfileTab {
  protected readonly c = SHARED_T.common;
  protected readonly t = T.profile;
  protected readonly f = T.studentForm;
  protected readonly s = T.students;
  private readonly api = inject(IdentityApi);
  private readonly date = inject(DatePipe);

  readonly student = input.required<Student>();
  /** The invitation link is being issued (the page does it, as from «⋮»). */
  readonly busy = input(false);
  /** The profile was saved: the page puts the student in its list. */
  readonly saved = output<Student>();
  /** «Новое приглашение» / «Сбросить пароль»: the page issues the link and shows it. */
  readonly invite = output();

  protected readonly pending = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly form = inject(NonNullableFormBuilder).group({
    displayName: ['', [Validators.required, Validators.maxLength(100)]],
    email: ['', [Validators.email, Validators.maxLength(254)]],
    phone: ['', [Validators.maxLength(32)]],
    note: ['', [Validators.maxLength(2000)]],
    defaultTopic: ['', [Validators.maxLength(500)]],
    color: new FormControl<LabelColor | null>(null),
  });
  private readonly value = toSignal(this.form.valueChanges);
  /** The fields differ from the saved profile. */
  protected readonly changed = computed(() => {
    this.value();
    const saved = inputOf(valueOf(this.student()));
    const typed = inputOf(this.form.getRawValue());
    return PROFILE_KEYS.some((key) => saved[key] !== typed[key]);
  });
  /** The saved profile the form shows: another student or a newer version fills it again. */
  private readonly shown = computed(() => `${this.student().id}:${String(this.student().version)}`);

  /** The room is set up for a student who still has access. */
  protected readonly roomOwner = computed<RoomOwnerRef | null>(
    () => {
      const student = this.student();
      return student.status === 'DEACTIVATED'
        ? null
        : { type: 'STUDENT', id: student.id, name: student.displayName };
    },
    // a saved profile is a new object of the same student: the panel keeps its room
    { equal: (a, b) => a?.id === b?.id && a?.name === b?.name },
  );
  /** Until when the issued link works, or that the access is off. */
  protected readonly accessLine = computed(() => {
    const student = this.student();
    if (student.status === 'DEACTIVATED') {
      return this.t.deactivated;
    }
    const invite = student.pendingInvite;
    if (invite === null) {
      return null;
    }
    const until = this.date.transform(invite.expiresAt, 'dd.MM.yyyy') ?? '';
    return invite.purpose === 'ACTIVATION' ? this.t.invited(until) : this.t.resetting(until);
  });

  constructor() {
    // untracked: the colour select reads its own signals when written
    effect(() => {
      this.shown();
      untracked(() => {
        this.cancel();
      });
    });
  }

  protected cancel(): void {
    this.error.set(null);
    this.form.reset(valueOf(this.student()));
  }

  protected save(): void {
    if (!revealErrors(this.form) || !this.changed() || this.pending()) {
      return;
    }
    const student = this.student();
    this.pending.set(true);
    this.error.set(null);
    this.api
      .updateStudent(student.id, inputOf(this.form.getRawValue()), student.version)
      .subscribe({
        next: (saved) => {
          this.pending.set(false);
          this.saved.emit(saved);
        },
        error: (error: unknown) => {
          this.pending.set(false);
          this.error.set(describeError(error, this.f.failed));
        },
      });
  }
}
