import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  linkedSignal,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Button } from 'primeng/button';
import { SelectButton } from 'primeng/selectbutton';
import { Tag } from 'primeng/tag';
import { BoardLinks } from '@features/boards/parts';
import { TeacherColors } from '@features/identity/parts';
import { JoinLessonButton } from '@features/meetings/parts';
import { SHARED_T } from '@shared/i18n/texts';
import { Avatar } from '@shared/ui/avatar';
import { ChangeRequest, LessonOutcome, ScheduledLesson } from '../data-access/schedule.models';
import {
  ATTENDANCE_LABELS,
  STATUS_LABELS,
  excusedFrom,
  formatLessonStart,
  formatLessonTime,
  requestKindLabel,
} from '../schedule-labels';
import { T } from '../i18n/texts';

/** The outcome the teacher picked in «Итог»; `null` — the mark was taken off. */
export interface OutcomeChange {
  readonly outcome: LessonOutcome | null;
  /** Puts the toggle back to what the lesson says, when saving failed. */
  readonly revert: () => void;
}

interface OutcomeOption {
  readonly value: LessonOutcome;
  readonly label: string;
  readonly icon: string;
}

/**
 * The content of a lesson's card, the same for the teacher and the student (ADR-0050): one segmented
 * list of facts — the time, the topic, the room, the boards, the reason of a cancellation — the
 * outcome «Итог» of a past lesson with one student as a connected toggle, the participants of a group
 * and the requests waiting for the teacher. It saves nothing by itself: the host (a
 * `<tb-dialog kind="sheet">`) saves the outcome and opens the answer to a request.
 */
@Component({
  selector: 'tb-lesson-card',
  imports: [FormsModule, Button, SelectButton, Tag, Avatar, BoardLinks, JoinLessonButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let item = lesson();
    @if (item.status !== 'SCHEDULED' || excused()) {
      <div class="tb-lesson-card__tags">
        @if (item.status !== 'SCHEDULED') {
          <p-tag [value]="status().label" [severity]="status().severity" />
        }
        @if (excused()) {
          <p-tag [value]="summary.excused" severity="secondary" />
        }
      </div>
    }
    <ul class="tb-list tb-list--no-phone-lead">
      <li>
        <span class="tb-list__lead" aria-hidden="true"><i class="tb-i tb-i-schedule"></i></span>
        <div class="tb-list__text">
          <span class="tb-list__title">{{ time() }}</span>
          @if (item.originalStartsAt !== null) {
            <span class="tb-list__supporting">{{ t.movedFrom(start(item.originalStartsAt)) }}</span>
          }
        </div>
      </li>
      @if (item.topic !== null) {
        <li>
          <span class="tb-list__lead" aria-hidden="true"><i class="tb-i tb-i-topic"></i></span>
          <div class="tb-list__text">
            <span class="tb-list__title">{{ item.topic }}</span>
          </div>
        </li>
      }
      @if (item.joinUrl !== null && item.status === 'SCHEDULED') {
        <li>
          <span class="tb-list__lead" aria-hidden="true"><i class="tb-i tb-i-videocam"></i></span>
          <div class="tb-list__text">
            <span class="tb-list__title">{{ t.room }}</span>
          </div>
          <div class="tb-list__trail">
            <tb-join-lesson-button
              [url]="item.joinUrl"
              [label]="teacher() ? t.start : actions.join"
              [teacher]="teacher()"
              [tonal]="true"
            />
          </div>
        </li>
      }
      @if (teacher()) {
        <li class="tb-lesson-card__boards">
          <span class="tb-list__lead" aria-hidden="true"><i class="tb-i tb-i-dashboard"></i></span>
          <div class="tb-list__text">
            <tb-board-links
              [chips]="true"
              [studentId]="item.groupId === null ? item.studentId : null"
              [groupId]="item.groupId"
            />
          </div>
        </li>
      }
      @if (item.cancelReason !== null) {
        <li>
          <span class="tb-list__lead" aria-hidden="true"><i class="tb-i tb-i-event_busy"></i></span>
          <div class="tb-list__text">
            <span class="tb-list__title">{{ t.cancelReason(item.cancelReason) }}</span>
          </div>
        </li>
      }
      @if (markable()) {
        <li>
          <span class="tb-list__lead" aria-hidden="true"><i class="tb-i tb-i-fact_check"></i></span>
          <div class="tb-list__text">
            <span class="tb-list__title">{{ t.outcome }}</span>
          </div>
          <div class="tb-list__trail">
            @for (key of [toggleKey()]; track key) {
              <p-selectbutton
                [options]="outcomes"
                optionLabel="label"
                optionValue="value"
                [allowEmpty]="true"
                [disabled]="busy()"
                [ngModel]="selected()"
                (ngModelChange)="pick($event)"
                [ariaLabel]="t.outcome"
              >
                <ng-template #item let-option>
                  <i [class]="'tb-i tb-i-' + option.icon" aria-hidden="true"></i>
                  <span>{{ option.label }}</span>
                </ng-template>
              </p-selectbutton>
            }
          </div>
        </li>
      }
      @for (request of item.pendingRequests; track request.id) {
        <li class="tb-lesson-card__request">
          <span class="tb-list__lead" aria-hidden="true"
            ><i class="tb-i tb-i-edit_calendar"></i
          ></span>
          <div class="tb-list__text">
            <span class="tb-list__title">{{ requestText(request) }}</span>
            @if (request.comment !== null) {
              <span class="tb-list__supporting">«{{ request.comment }}»</span>
            }
          </div>
          @if (teacher()) {
            <div class="tb-list__trail">
              <p-button [label]="t.answer" severity="secondary" (onClick)="answer.emit(request)" />
            </div>
          }
        </li>
      }
    </ul>
    @if (teacher() && item.groupId !== null) {
      <h3 class="tb-lesson-card__subtitle">{{ t.participants }}</h3>
      <ul class="tb-list">
        @for (participant of item.participants; track participant.studentId) {
          <li>
            <tb-avatar
              [attr.data-tb-label]="colors.studentLabel(participant.studentId)"
              [name]="participant.studentName ?? c.student"
              [photo]="participant.studentAvatar"
            />
            <div class="tb-list__text">
              <span class="tb-list__title">{{ participant.studentName ?? c.student }}</span>
            </div>
            @if (participant.attendance !== 'EXPECTED') {
              <div class="tb-list__trail">
                <p-tag
                  [value]="attendance[participant.attendance].label"
                  [severity]="attendance[participant.attendance].severity"
                />
              </div>
            }
          </li>
        }
      </ul>
    }
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: var(--tb-space-3);
    }

    .tb-lesson-card__tags {
      display: flex;
      flex-wrap: wrap;
      gap: var(--tb-space-2);
    }

    .tb-lesson-card__subtitle {
      margin: var(--tb-space-2) 0 0;
      font: var(--tb-type-title-m);
    }

    /* M3: tertiary marks the small element that needs attention (a request waits for an answer) */
    .tb-lesson-card__request {
      background: var(--p-md-tertiary-container);
      color: var(--p-md-on-tertiary-container);
    }

    /*
     * The rows share the columns of the list (subgrid), so the wide toggle «Проведено / Пропуск» would
     * squeeze the text of every row, the date too. Its row keeps its own columns: the lead keeps its
     * width (2.5rem; none on a phone), the toggle takes only its own room.
     */
    @container (width > 26rem) {
      .tb-list > li:has(> .tb-list__trail p-selectbutton) {
        grid-template-columns: 2.5rem minmax(0, 1fr) auto;
      }
    }

    @media (width < 37.5em) {
      @container (width > 26rem) {
        .tb-list > li:has(> .tb-list__trail p-selectbutton) {
          grid-template-columns: minmax(0, 1fr) auto;
        }
      }
    }

    /* a narrow card: the toggle goes under the text, as the buttons of a row do (styles.scss) */
    @container (max-width: 26rem) {
      .tb-list > li:has(> .tb-list__trail p-selectbutton) {
        grid-template-areas: 'text text' 'trail trail';
      }
    }

    /* without boards the row is not shown */
    .tb-lesson-card__boards:not(:has(.tb-board-chips)) {
      display: none;
    }
  `,
})
export class LessonCard {
  protected readonly t = T.details;
  protected readonly actions = T.actions;
  protected readonly summary = T.summary;
  protected readonly c = SHARED_T.common;
  protected readonly colors = inject(TeacherColors);
  protected readonly attendance = ATTENDANCE_LABELS;
  protected readonly outcomes: OutcomeOption[] = [
    { value: 'CONDUCTED', label: T.details.conducted, icon: 'check' },
    { value: 'MISSED', label: T.details.missed, icon: 'person_remove' },
  ];

  readonly lesson = input.required<ScheduledLesson>();
  readonly role = input<'teacher' | 'student'>('teacher');
  /** Current time, for deciding whether the outcome can be marked. */
  readonly now = input<Date>(new Date());
  /** The outcome is being saved. */
  readonly busy = input(false);

  /** The teacher picked an outcome or took the mark off. */
  readonly outcomeChange = output<OutcomeChange>();
  /** The teacher wants to answer a request of the student. */
  readonly answer = output<ChangeRequest>();

  protected readonly teacher = computed(() => this.role() === 'teacher');
  protected readonly status = computed(() => STATUS_LABELS[this.lesson().status]);
  protected readonly excused = computed(() => !this.teacher() && excusedFrom(this.lesson()));
  protected readonly time = computed(() => {
    const lesson = this.lesson();
    return formatLessonTime(lesson.startsAt, lesson.endsAt);
  });
  /** The outcome of a started lesson with one student is marked on the spot, not in a footer. */
  protected readonly markable = computed(() => {
    const lesson = this.lesson();
    return (
      this.teacher() &&
      lesson.groupId === null &&
      lesson.status !== 'CANCELLED' &&
      new Date(lesson.startsAt) <= this.now()
    );
  });
  /** What the lesson says now; the toggle shows it until the next pick. */
  protected readonly selected = linkedSignal<LessonOutcome | null>(() => {
    const status = this.lesson().status;
    return status === 'CONDUCTED' || status === 'MISSED' ? status : null;
  });

  /** The toggle is made anew when the mark was taken back from outside: PrimeNG keeps the pressed button. */
  protected readonly toggleKey = signal(0);
  private picked: LessonOutcome | null = null;

  constructor() {
    effect(() => {
      if (this.lesson().status === 'SCHEDULED' && this.picked !== null) {
        this.picked = null;
        this.toggleKey.update((key) => key + 1);
      }
    });
  }

  protected start(iso: string): string {
    return formatLessonStart(iso);
  }

  protected requestText(request: ChangeRequest): string {
    const kind = requestKindLabel(request);
    if (!this.teacher()) {
      return this.summary.pending(kind);
    }
    const who =
      this.lesson().groupId === null
        ? this.t.studentRequest
        : (request.studentName ?? this.c.student);
    const when =
      request.proposedStartsAt === null
        ? ''
        : ` ${this.t.to(this.start(request.proposedStartsAt))}`;
    return `${who}: ${kind}${when}`;
  }

  protected pick(value: LessonOutcome | null): void {
    const previous = this.selected();
    this.picked = value;
    this.selected.set(value);
    this.outcomeChange.emit({
      outcome: value,
      revert: () => {
        this.selected.set(previous);
      },
    });
  }
}
