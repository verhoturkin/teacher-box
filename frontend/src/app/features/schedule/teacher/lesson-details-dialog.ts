import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  model,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MenuItem } from 'primeng/api';
import { Button } from 'primeng/button';
import { Checkbox } from 'primeng/checkbox';
import { Dialog } from 'primeng/dialog';
import { Menu } from 'primeng/menu';
import { Message } from 'primeng/message';
import { Select } from 'primeng/select';
import { Tag } from 'primeng/tag';
import { Textarea } from 'primeng/textarea';
import { Tooltip } from 'primeng/tooltip';
import { BoardLinks } from '@features/boards/parts';
import { JoinLessonButton } from '@features/meetings/parts';
import { describeError } from '@core/http/error-messages';
import { problemCode } from '@core/http/problem-detail';
import { Observable } from 'rxjs';
import { ScheduleApi } from '../data-access/schedule-api';
import {
  FollowingLessons,
  RepeatScope,
  LessonOutcome,
  ScheduledLesson,
} from '../data-access/schedule.models';
import {
  ATTENDANCE_LABELS,
  STATUS_LABELS,
  formatLessonStart,
  formatLessonTime,
  lessonWith,
  requestKindLabel,
} from '../schedule-labels';
import { Avatar } from '@shared/ui/avatar';
import { TeacherColors } from '@features/identity/parts';
import { AttendanceDialog } from './attendance-dialog';
import { T } from '../i18n/texts';
import { SHARED_T } from '@shared/i18n/texts';

/**
 * A lesson with the teacher's actions: change it, mark the outcome (the attendance of a group) after
 * it has started, withdraw the outcome, cancel it (a lesson with one student also on the student's
 * behalf, optionally charged as a missed lesson), restore a cancelled one or delete one that was not
 * held.
 */
@Component({
  selector: 'tb-lesson-details-dialog',
  imports: [
    Avatar,
    FormsModule,
    Select,
    Button,
    Checkbox,
    Dialog,
    Menu,
    Message,
    Tag,
    Textarea,
    Tooltip,
    AttendanceDialog,
    JoinLessonButton,
    BoardLinks,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-dialog
      [(visible)]="visible"
      [modal]="true"
      styleClass="tb-dialog"
      [draggable]="false"
      [focusOnShow]="false"
      (onShow)="focusTitle()"
    >
      <ng-template #header let-labelledBy="ariaLabelledBy">
        <div class="tb-dialog-head">
          <span #title class="p-dialog-title" tabindex="-1" [id]="labelledBy">{{ t.title }}</span>
          @if (lesson(); as lesson) {
            <span class="tb-dialog-head__actions">
              @if (lesson.status === 'SCHEDULED') {
                <p-button
                  icon="tb-i tb-i-edit"
                  severity="secondary"
                  [text]="true"
                  [rounded]="true"
                  [pTooltip]="t.edit"
                  [ariaLabel]="t.edit"
                  (onClick)="editLesson()"
                />
              }
              @if (menuItems().length > 0) {
                <p-button
                  icon="tb-i tb-i-more_vert"
                  severity="secondary"
                  [text]="true"
                  [rounded]="true"
                  [pTooltip]="t.more"
                  [ariaLabel]="t.more"
                  aria-haspopup="menu"
                  (onClick)="menu.toggle($event)"
                />
                <p-menu #menu [model]="menuItems()" [popup]="true" appendTo="body" />
              }
            </span>
          }
        </div>
      </ng-template>
      @if (lesson(); as lesson) {
        <div class="tb-lesson-details">
          <div class="tb-lesson-details__head">
            <strong>{{ with(lesson) }}</strong>
            <p-tag [value]="statusLabel().label" [severity]="statusLabel().severity" />
          </div>
          <div>{{ time() }}</div>
          @if (lesson.originalStartsAt !== null) {
            <small class="tb-muted">{{ t.movedFrom(start(lesson.originalStartsAt)) }}</small>
          }
          @if (lesson.topic !== null) {
            <div>{{ t.topic(lesson.topic) }}</div>
          }
          @if (lesson.joinUrl; as url) {
            <div>
              <tb-join-lesson-button
                [url]="url"
                [label]="t.start"
                [teacher]="true"
                [tonal]="true"
              />
            </div>
          }
          @if (visible()) {
            <tb-board-links
              [studentId]="lesson.groupId === null ? lesson.studentId : null"
              [groupId]="lesson.groupId"
            />
          }
          @if (lesson.cancelReason !== null) {
            <div class="tb-muted">{{ t.cancelReason(lesson.cancelReason) }}</div>
          }
          @if (lesson.groupId !== null) {
            <ul class="tb-list">
              @for (participant of lesson.participants; track participant.studentId) {
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
          @for (request of lesson.pendingRequests; track request.id) {
            <div class="tb-lesson-details__request">
              {{ lesson.groupId === null ? t.studentRequest : (request.studentName ?? c.student) }}:
              {{ kind(request) }}
              @if (request.proposedStartsAt !== null) {
                {{ t.to(start(request.proposedStartsAt)) }}
              }
              @if (request.comment !== null) {
                — «{{ request.comment }}»
              }
            </div>
          }
        </div>

        @if (deleting()) {
          <p-message severity="warn" styleClass="tb-lesson-details__cancel">
            {{ t.deleteWarning }}
            @if (lesson.status === 'SCHEDULED') {
              {{ t.deleteNotice }}
            }
          </p-message>
        }
        @if (overlap()) {
          <p-message severity="warn" styleClass="tb-lesson-details__cancel">
            {{ t.overlap }}
            <p-button [label]="t.restoreAnyway" [text]="true" (onClick)="restore(true)" />
          </p-message>
        }
        @if (error(); as message) {
          <p-message severity="error" styleClass="tb-lesson-details__cancel">{{
            message
          }}</p-message>
        }
        @if (cancelling()) {
          <div class="tb-form tb-lesson-details__cancel">
            <div class="tb-field">
              <label for="lesson-cancel-reason">{{ t.reason }}</label>
              <textarea
                pTextarea
                id="lesson-cancel-reason"
                rows="2"
                [(ngModel)]="reason"
                maxlength="500"
              ></textarea>
            </div>
            @if (lesson.groupId === null) {
              <label class="tb-switch" for="lesson-cancel-by-student">
                <p-checkbox
                  [(ngModel)]="byStudent"
                  [binary]="true"
                  inputId="lesson-cancel-by-student"
                />
                <span>{{ t.byStudent }}</span>
              </label>
            }
            @if (byStudent()) {
              <label class="tb-switch" for="lesson-cancel-charge">
                <p-checkbox [(ngModel)]="charge" [binary]="true" inputId="lesson-cancel-charge" />
                <span>{{ t.charge }}</span>
              </label>
            }
          </div>
        }
      }
      <ng-template #footer>
        @if (lesson(); as lesson) {
          @if ((cancelling() || deleting()) && lesson.seriesId) {
            <div class="tb-field">
              <label id="lesson-action-scope-label" for="lesson-action-scope">{{
                repeatTexts.scope
              }}</label>
              <p-select
                inputId="lesson-action-scope"
                ariaLabelledBy="lesson-action-scope-label"
                [ngModel]="scope()"
                (ngModelChange)="chooseScope($event)"
                [options]="scopes"
                optionLabel="label"
                optionValue="value"
                appendTo="body"
                [fluid]="true"
              />
            </div>
            @if (preview(); as affected) {
              <p-message severity="info">{{
                repeatTexts.affected(affected.affected.length, affected.protectedLessons.length)
              }}</p-message>
            }
          }
          @if (deleting()) {
            <p-button
              [label]="c.cancel"
              severity="secondary"
              [text]="true"
              (onClick)="deleting.set(false)"
            />
            <p-button
              [label]="t.deleteLesson"
              severity="danger"
              [loading]="pending()"
              (onClick)="deleteLesson()"
            />
          } @else if (cancelling()) {
            <p-button
              [label]="c.cancel"
              severity="secondary"
              [text]="true"
              (onClick)="cancelling.set(false)"
            />
            <p-button
              [label]="t.cancelLesson"
              severity="danger"
              [loading]="pending()"
              (onClick)="cancel()"
            />
          } @else if (lesson.status === 'CANCELLED') {
            <p-button
              [label]="t.restore"
              icon="tb-i tb-i-replay"
              [loading]="pending()"
              (onClick)="restore()"
            />
          } @else if (started() && lesson.groupId !== null) {
            <p-button
              [label]="t.markAttendance"
              icon="tb-i tb-i-group"
              (onClick)="markAttendance()"
            />
          } @else if (started()) {
            <span
              class="tb-button-group tb-button-group--connected"
              role="group"
              [attr.aria-label]="t.outcome"
            >
              @if (lesson.status !== 'MISSED') {
                <p-button
                  [label]="t.missed"
                  severity="secondary"
                  [loading]="pending()"
                  (onClick)="mark('MISSED')"
                />
              }
              @if (lesson.status !== 'CONDUCTED') {
                <p-button
                  [label]="t.conducted"
                  [loading]="pending()"
                  (onClick)="mark('CONDUCTED')"
                />
              }
            </span>
          } @else {
            <p-button
              [label]="c.close"
              severity="secondary"
              [text]="true"
              (onClick)="visible.set(false)"
            />
          }
        }
      </ng-template>
    </p-dialog>

    <tb-attendance-dialog
      [(visible)]="attendanceVisible"
      [lesson]="lesson()"
      (saved)="onMarked($event)"
    />
  `,
  styles: `
    .tb-dialog-head {
      display: flex;
      flex: 1;
      align-items: center;
      justify-content: space-between;
      gap: var(--tb-space-2);
      min-width: 0;
    }

    .tb-dialog-head__actions {
      display: inline-flex;
      gap: var(--tb-space-1);
    }

    .tb-lesson-details {
      display: flex;
      flex-direction: column;
      gap: var(--tb-space-2);
    }

    .tb-lesson-details__head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--tb-space-4);
    }

    .tb-lesson-details__participants {
      display: flex;
      flex-direction: column;
      gap: var(--tb-space-1);
      margin: 0;
      padding: 0;
      list-style: none;

      li {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--tb-space-2);
      }
    }

    .tb-lesson-details__request {
      padding: var(--tb-space-2) var(--tb-space-3);
      border-radius: var(--tb-shape-md);
      background: var(--p-md-secondary-container);
      color: var(--p-md-on-secondary-container);
    }

    .tb-lesson-details__cancel {
      margin-top: var(--tb-space-4);
    }
  `,
})
export class LessonDetailsDialog {
  protected readonly c = SHARED_T.common;
  protected readonly repeatTexts = T.lessonDialog;
  protected readonly scope = signal<RepeatScope>('ONLY');
  protected readonly preview = signal<FollowingLessons | null>(null);
  protected readonly scopes = [
    { value: 'ONLY', label: T.lessonDialog.onlyThis },
    { value: 'FOLLOWING', label: T.lessonDialog.thisFollowing },
  ];

  protected chooseScope(scope: RepeatScope): void {
    this.scope.set(scope);
    this.preview.set(null);
    const lesson = this.lesson();
    if (scope === 'FOLLOWING' && lesson) {
      this.api.following(lesson.id).subscribe({
        next: (preview) => {
          if (this.scope() === 'FOLLOWING' && this.lesson()?.id === lesson.id)
            this.preview.set(preview);
        },
        error: (error: unknown) => {
          this.error.set(describeError(error, T.lessonDialog.previewFailed));
        },
      });
    }
  }
  protected readonly t = T.details;
  protected readonly colors = inject(TeacherColors);
  private readonly api = inject(ScheduleApi);

  readonly visible = model(false);
  readonly lesson = input<ScheduledLesson | null>(null);
  /** Current time, for deciding whether the outcome can be marked. */
  readonly now = input<Date>(new Date());
  readonly changed = output<ScheduledLesson>();
  /** The lesson was deleted. */
  readonly deleted = output<string>();
  readonly edit = output<ScheduledLesson>();

  protected readonly kind = requestKindLabel;
  protected readonly with = lessonWith;
  protected readonly attendance = ATTENDANCE_LABELS;
  private readonly title = viewChild<ElementRef<HTMLElement>>('title');

  protected readonly attendanceVisible = signal(false);
  protected readonly pending = signal(false);
  protected readonly cancelling = signal(false);
  protected readonly deleting = signal(false);
  protected readonly overlap = signal(false);
  protected readonly error = signal<string | null>(null);
  /** Not held and nobody charged: planned, or cancelled without a charge (that one is «missed»). */
  protected readonly deletable = computed(() => {
    const lesson = this.lesson();
    return (
      lesson !== null &&
      (lesson.status === 'SCHEDULED' || lesson.status === 'CANCELLED') &&
      lesson.participants.every((participant) => participant.attendance !== 'MISSED')
    );
  });
  /** The actions with consequences are in the menu of the header, away from the footer (ADR-0026). */
  protected readonly menuItems = computed<MenuItem[]>(() => {
    const lesson = this.lesson();
    if (lesson === null) {
      return [];
    }
    const items: MenuItem[] = [];
    if (lesson.status === 'SCHEDULED') {
      items.push({
        label: T.details.cancelItem,
        icon: 'tb-i tb-i-cancel',
        command: () => {
          this.cancelling.set(true);
        },
      });
    }
    if (lesson.status === 'CONDUCTED' || lesson.status === 'MISSED') {
      items.push({
        label: T.details.unmark,
        icon: 'tb-i tb-i-undo',
        command: () => {
          this.reopen();
        },
      });
    }
    if (this.deletable()) {
      items.push({
        label: T.details.deleteItem,
        icon: 'tb-i tb-i-delete',
        styleClass: 'tb-menu-item--danger',
        command: () => {
          this.deleting.set(true);
        },
      });
    }
    return items;
  });
  protected readonly reason = signal('');
  protected readonly byStudent = signal(false);
  protected readonly charge = signal(false);
  protected readonly statusLabel = computed(
    () => STATUS_LABELS[this.lesson()?.status ?? 'SCHEDULED'],
  );
  protected readonly time = computed(() => {
    const lesson = this.lesson();
    return lesson === null ? '' : formatLessonTime(lesson.startsAt, lesson.endsAt);
  });
  protected readonly started = computed(() => {
    const lesson = this.lesson();
    return lesson !== null && new Date(lesson.startsAt) <= this.now();
  });

  constructor() {
    effect(() => {
      if (this.visible()) {
        this.scope.set('ONLY');
        this.preview.set(null);
        this.cancelling.set(false);
        this.deleting.set(false);
        this.overlap.set(false);
        this.error.set(null);
        this.reason.set('');
        this.byStudent.set(false);
        this.charge.set(false);
      }
    });
  }

  /** The first thing under the hand is the title, not a button: Enter starts or deletes nothing. */
  focusTitle(): void {
    this.title()?.nativeElement.focus();
  }

  protected start(iso: string): string {
    return formatLessonStart(iso);
  }

  editLesson(): void {
    const lesson = this.lesson();
    if (lesson !== null) {
      this.visible.set(false);
      this.edit.emit(lesson);
    }
  }

  /** The attendance replaces the details: a window does not open over a window (ADR-0026). */
  markAttendance(): void {
    this.visible.set(false);
    this.attendanceVisible.set(true);
  }

  mark(outcome: LessonOutcome): void {
    this.run((lesson) => this.api.setOutcome(lesson.id, outcome));
  }

  onMarked(lesson: ScheduledLesson): void {
    this.visible.set(false);
    this.changed.emit(lesson);
  }

  reopen(): void {
    this.run((lesson) => this.api.reopen(lesson.id));
  }

  cancel(): void {
    if (this.scope() === 'FOLLOWING' && this.preview() === null) return;
    const reason = this.reason().trim();
    this.run((lesson) =>
      this.api.cancel(lesson.id, {
        reason: reason === '' ? null : reason,
        byStudent: this.byStudent(),
        charge: this.byStudent() && this.charge(),
        scope: this.scope(),
        version: lesson.version,
        repeatVersion: this.preview()?.repeatVersion ?? lesson.repeatVersion,
      }),
    );
  }

  deleteLesson(): void {
    const lesson = this.lesson();
    if (
      lesson === null ||
      this.pending() ||
      (this.scope() === 'FOLLOWING' && this.preview() === null)
    ) {
      return;
    }
    this.pending.set(true);
    this.api
      .deleteLesson(
        lesson.id,
        this.scope(),
        lesson.version,
        this.preview()?.repeatVersion ?? lesson.repeatVersion,
      )
      .subscribe({
        next: () => {
          this.pending.set(false);
          this.visible.set(false);
          this.deleted.emit(lesson.id);
        },
        error: () => {
          this.pending.set(false);
        },
      });
  }

  restore(allowOverlap = false): void {
    const lesson = this.lesson();
    if (lesson === null || this.pending()) {
      return;
    }
    this.pending.set(true);
    this.overlap.set(false);
    this.error.set(null);
    this.api.restore(lesson.id, allowOverlap).subscribe({
      next: (restored) => {
        this.pending.set(false);
        this.visible.set(false);
        this.changed.emit(restored);
      },
      error: (error: unknown) => {
        this.pending.set(false);
        if (problemCode(error) === 'schedule.overlap') {
          this.overlap.set(true);
        } else {
          this.error.set(describeError(error, T.details.restoreFailed));
        }
      },
    });
  }

  private run(action: (lesson: ScheduledLesson) => Observable<ScheduledLesson>): void {
    const lesson = this.lesson();
    if (lesson === null || this.pending()) {
      return;
    }
    this.pending.set(true);
    action(lesson).subscribe({
      next: (updated) => {
        this.pending.set(false);
        this.visible.set(false);
        this.changed.emit(updated);
      },
      error: () => {
        this.pending.set(false);
      },
    });
  }
}
