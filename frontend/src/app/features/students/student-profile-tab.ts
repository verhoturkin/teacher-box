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
import { Course, CurrentCourseCard } from '@features/textbooks/parts';
import { describeError } from '@core/http/error-messages';
import { LabelColor } from '@core/theme/label-colors';
import { SHARED_T } from '@shared/i18n/texts';
import { FieldErrors, revealErrors } from '@shared/ui/field-errors';
import {
  IdentityApi,
  LabelColorField,
  Student,
  StudentProfileInput,
} from '@features/identity/parts';
import { T } from './i18n/texts';
import { StudentGuardiansCard } from './student-guardians-card';

/** The profile of a student as the form holds it: empty strings for missing values. */
interface ProfileValue {
  readonly displayName: string;
  readonly email: string;
  readonly phone: string;
  readonly note: string;
  readonly defaultTopic: string;
  readonly color: LabelColor | null;
}

/** The cards of the profile with a form each: a card saves only its own fields. */
type Section = 'details' | 'lessons';

const SECTION_KEYS: Readonly<Record<Section, readonly (keyof StudentProfileInput)[]>> = {
  details: ['displayName', 'email', 'phone', 'note'],
  lessons: ['defaultTopic', 'color'],
};

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
 * place — cards in the grid of Settings (two columns on wide screens): «Данные ученика» (the name, the
 * contacts, the note) and «Занятия» (the default topic, the colour), each with its tonal «Сохранить» that
 * saves its own fields and «Отмена» that brings back the saved ones; «Курс» (ADR-0071, saved when chosen),
 * the lesson price, the video meeting, «Родители» (ADR-0069) and «Вход в кабинет» (the login the student
 * chose, the invitation link).
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
    StudentGuardiansCard,
    CurrentCourseCard,
  ],
  providers: [DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let row = student();
    <div class="tb-settings-grid">
      <p-card [header]="t.details">
        <form
          tbFieldErrors
          class="tb-form"
          [formGroup]="form.controls.details"
          (ngSubmit)="save('details')"
        >
          <div class="tb-field tb-field--required">
            <label for="profile-name">{{ f.name }}</label>
            <input
              pInputText
              id="profile-name"
              formControlName="displayName"
              autocomplete="off"
              placeholder=" "
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
              placeholder=" "
            />
          </div>
          <div class="tb-field">
            <label for="profile-phone">{{ f.phone }}</label>
            <input
              pInputText
              id="profile-phone"
              formControlName="phone"
              autocomplete="off"
              placeholder=" "
            />
          </div>
          <div class="tb-field">
            <label for="profile-note">{{ f.note }}</label>
            <textarea
              pTextarea
              id="profile-note"
              formControlName="note"
              rows="3"
              placeholder=" "
            ></textarea>
          </div>
          @if (error(); as failure) {
            @if (failure.section === 'details') {
              <p-message severity="error" styleClass="tb-form-message">{{
                failure.message
              }}</p-message>
            }
          }
          <div class="tb-form-actions">
            @if (changed().details) {
              <p-button
                [label]="c.cancel"
                severity="secondary"
                [text]="true"
                (onClick)="cancel('details')"
              />
            }
            <p-button
              type="submit"
              severity="secondary"
              [label]="c.save"
              icon="tb-i tb-i-check"
              [disabled]="!changed().details"
              [loading]="pending() === 'details'"
            />
          </div>
        </form>
      </p-card>

      <p-card [header]="t.lessons">
        <form
          tbFieldErrors
          class="tb-form"
          [formGroup]="form.controls.lessons"
          (ngSubmit)="save('lessons')"
        >
          <div class="tb-field">
            <label for="profile-topic">{{ f.defaultTopic }}</label>
            <input
              pInputText
              id="profile-topic"
              formControlName="defaultTopic"
              autocomplete="off"
              placeholder=" "
              aria-describedby="profile-topic-hint"
            />
            <small id="profile-topic-hint" class="tb-hint">{{ f.defaultTopicHint }}</small>
          </div>
          <tb-label-color-field
            inputId="profile-color"
            [control]="form.controls.lessons.controls.color"
          />
          @if (error(); as failure) {
            @if (failure.section === 'lessons') {
              <p-message severity="error" styleClass="tb-form-message">{{
                failure.message
              }}</p-message>
            }
          }
          <div class="tb-form-actions">
            @if (changed().lessons) {
              <p-button
                [label]="c.cancel"
                severity="secondary"
                [text]="true"
                (onClick)="cancel('lessons')"
              />
            }
            <p-button
              type="submit"
              severity="secondary"
              [label]="c.save"
              icon="tb-i tb-i-check"
              [disabled]="!changed().lessons"
              [loading]="pending() === 'lessons'"
            />
          </div>
        </form>
      </p-card>

      <tb-current-course-card
        [owner]="{ kind: 'STUDENT', id: row.id }"
        [courses]="courses()"
        [courseId]="courseId()"
        [disabled]="row.status === 'DEACTIVATED'"
        (changed)="courseChanged.emit($event)"
      />

      <tb-student-price-card [studentId]="row.id" />

      <tb-room-panel [owner]="roomOwner()" />

      <tb-student-guardians-card [student]="row" />

      <p-card [header]="t.access">
        <div class="tb-form">
          <div class="tb-field">
            <label for="profile-login">{{ f.login }}</label>
            <input
              pInputText
              id="profile-login"
              readonly
              placeholder=" "
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
              <p-button
                [label]="s.deactivateItem"
                icon="tb-i tb-i-block"
                severity="secondary"
                [disabled]="busy()"
                (onClick)="deactivate.emit()"
              />
            </div>
          } @else {
            <div class="tb-form-actions">
              <p-button
                [label]="s.reactivate"
                icon="tb-i tb-i-replay"
                severity="secondary"
                [loading]="busy()"
                (onClick)="reactivate.emit()"
              />
            </div>
          }
        </div>
      </p-card>
    </div>
  `,
  styles: `
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
  /** The page is issuing the invitation link. */
  readonly busy = input(false);
  /** The teacher's courses and the student's current one (ADR-0071). */
  readonly courses = input<readonly Course[]>([]);
  readonly courseId = input<string | null>(null);
  readonly courseChanged = output<string | null>();
  /** The profile was saved: the page puts the student in its list. */
  readonly saved = output<Student>();
  /** «Новое приглашение» / «Сбросить пароль»: the page issues the link and shows it. */
  readonly invite = output();
  readonly deactivate = output();
  readonly reactivate = output();

  /** The card being saved. */
  protected readonly pending = signal<Section | null>(null);
  protected readonly error = signal<{ readonly section: Section; readonly message: string } | null>(
    null,
  );

  private readonly fb = inject(NonNullableFormBuilder);
  protected readonly form = this.fb.group({
    details: this.fb.group({
      displayName: ['', [Validators.required, Validators.maxLength(100)]],
      email: ['', [Validators.email, Validators.maxLength(254)]],
      phone: ['', [Validators.maxLength(32)]],
      note: ['', [Validators.maxLength(2000)]],
    }),
    lessons: this.fb.group({
      defaultTopic: ['', [Validators.maxLength(500)]],
      color: new FormControl<LabelColor | null>(null),
    }),
  });
  private readonly value = toSignal(this.form.valueChanges);
  /** The fields of each card differ from the saved profile. */
  protected readonly changed = computed<Readonly<Record<Section, boolean>>>(() => {
    this.value();
    const saved = inputOf(valueOf(this.student()));
    const typed = inputOf(this.typed());
    const differs = (section: Section): boolean =>
      SECTION_KEYS[section].some((key) => saved[key] !== typed[key]);
    return { details: differs('details'), lessons: differs('lessons') };
  });
  /** The saved profile the form was filled with. */
  private filledWith: { readonly id: string; readonly profile: StudentProfileInput } | null = null;
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
        this.refill();
      });
    });
  }

  /**
   * A card is filled again unless it has typed changes and its saved fields stay the same (the other
   * card was saved, the invitation changed): those changes wait for its «Сохранить».
   */
  private refill(): void {
    const before = this.filledWith;
    const student = this.student();
    const now = inputOf(valueOf(student));
    this.filledWith = { id: student.id, profile: now };
    const changed = this.changed();
    for (const section of ['details', 'lessons'] as const) {
      const same =
        before?.id === student.id &&
        SECTION_KEYS[section].every((key) => before.profile[key] === now[key]);
      if (!same || !changed[section]) {
        this.cancel(section);
      }
    }
  }

  private typed(): ProfileValue {
    const { details, lessons } = this.form.getRawValue();
    return { ...details, ...lessons };
  }

  protected cancel(section: Section): void {
    if (this.error()?.section === section) {
      this.error.set(null);
    }
    const saved = valueOf(this.student());
    if (section === 'details') {
      this.form.controls.details.reset(saved);
    } else {
      this.form.controls.lessons.reset(saved);
    }
  }

  protected save(section: Section): void {
    const fields = this.form.controls[section];
    if (!revealErrors(fields) || !this.changed()[section] || this.pending() !== null) {
      return;
    }
    const student = this.student();
    // the other card keeps its saved values: its typed changes wait for its own «Сохранить»
    const profile = { ...valueOf(student), ...fields.getRawValue() };
    this.pending.set(section);
    this.error.set(null);
    this.api.updateStudent(student.id, inputOf(profile), student.version).subscribe({
      next: (saved) => {
        this.pending.set(null);
        this.saved.emit(saved);
      },
      error: (error: unknown) => {
        this.pending.set(null);
        this.error.set({ section, message: describeError(error, this.f.failed) });
      },
    });
  }
}
