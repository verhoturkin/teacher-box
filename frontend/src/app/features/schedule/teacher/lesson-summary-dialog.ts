import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  linkedSignal,
  model,
  output,
  signal,
} from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { EMPTY, Observable, catchError, concat, filter, last, of, switchMap, take } from 'rxjs';
import { Button } from 'primeng/button';
import { SelectButton } from 'primeng/selectbutton';
import { Textarea } from 'primeng/textarea';
import { describeError } from '@core/http/error-messages';
import { Snackbar } from '@core/snackbar/snackbar';
import { AiApi } from '@features/ai/parts';
import { AssignmentSummary, HomeworkApi } from '@features/homework/parts';
import { SHARED_T } from '@shared/i18n/texts';
import { Avatar } from '@shared/ui/avatar';
import { DialogFooter, TbDialog } from '@shared/ui/dialog/dialog';
import { dialogSubmit } from '@shared/ui/dialog/dialog-submit';
import { MarkdownView } from '@shared/ui/markdown-view';
import { ScheduleApi } from '../data-access/schedule-api';
import { ScheduledLesson } from '../data-access/schedule.models';
import { T } from '../i18n/texts';

type SummaryMode = 'edit' | 'preview';

/**
 * «Итоги урока» as a dialog of its own, opened by the row «Итоги» of the lesson card: «Что прошли»
 * (Markdown, `Текст / Просмотр` as in the homework editor), «Что дальше» and the private «Заметка для
 * себя» (one field for a lesson with one student; a group lists the students, each folds open). Nothing
 * saves by itself: «Сохранить», or «Сохранить и отправить» that tells the participants too (not while
 * «Что прошли» is empty).
 */
@Component({
  selector: 'tb-lesson-summary-dialog',
  imports: [
    FormsModule,
    Button,
    SelectButton,
    Textarea,
    Avatar,
    MarkdownView,
    TbDialog,
    DialogFooter,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <tb-dialog
      kind="form"
      [(visible)]="visible"
      [headline]="t.dialog"
      [cancelLabel]="c.cancel"
      [pending]="submit.pending()"
      [error]="submit.error()"
      [dirty]="dirty()"
    >
      @if (lesson(); as item) {
        <div class="tb-form">
          <div class="tb-field">
            <div class="tb-field__header">
              <label for="lesson-summary-text">{{ t.covered }}</label>
              @if (aiEnabled()) {
                <p-button
                  class="tb-lesson-summary__draft-toggle"
                  [label]="t.draft"
                  icon="tb-i tb-i-auto_awesome"
                  severity="secondary"
                  [text]="true"
                  [attr.aria-expanded]="draftOpen()"
                  aria-controls="lesson-summary-draft"
                  (onClick)="toggleDraft()"
                />
              }
              <p-selectbutton
                [options]="modes"
                [ngModel]="mode()"
                (ngModelChange)="mode.set($event)"
                optionLabel="label"
                optionValue="value"
                [allowEmpty]="false"
                [ariaLabel]="t.mode"
              />
            </div>
            @if (aiEnabled() && draftOpen()) {
              <div class="tb-lesson-summary__draft" id="lesson-summary-draft">
                <label for="lesson-summary-words">{{ t.draftWords }}</label>
                <textarea
                  pTextarea
                  id="lesson-summary-words"
                  rows="2"
                  maxlength="2000"
                  [placeholder]="t.draftPlaceholder"
                  [ngModel]="words()"
                  (ngModelChange)="words.set($event)"
                ></textarea>
                @if (error(); as message) {
                  <small class="tb-error" role="alert">{{ message }}</small>
                } @else if (!hasInput(item)) {
                  <small class="tb-hint">{{ t.draftNeedsInput }}</small>
                }
                <div class="tb-actions">
                  <p-button
                    [label]="drafted() ? t.draftAgain : t.draftRun"
                    [icon]="drafted() ? 'tb-i tb-i-refresh' : 'tb-i tb-i-auto_awesome'"
                    [disabled]="!hasInput(item)"
                    [loading]="drafting()"
                    (onClick)="draft(item)"
                  />
                </div>
              </div>
            }
            @if (mode() === 'preview') {
              <div class="tb-preview tb-lesson-summary__preview">
                <tb-markdown [text]="summary()" />
              </div>
            } @else {
              <textarea
                pTextarea
                id="lesson-summary-text"
                rows="5"
                maxlength="4000"
                [ngModel]="summary()"
                (ngModelChange)="summary.set($event)"
              ></textarea>
            }
          </div>

          <div class="tb-field">
            <label for="lesson-summary-next">{{ t.nextPlan }}</label>
            <textarea
              pTextarea
              id="lesson-summary-next"
              rows="2"
              maxlength="1000"
              [ngModel]="nextPlan()"
              (ngModelChange)="nextPlan.set($event)"
            ></textarea>
            <small class="tb-hint">{{ t.nextPlanHint }}</small>
          </div>

          @if (item.groupId === null) {
            @let only = item.participants[0]?.studentId ?? '';
            <div class="tb-field">
              <label for="lesson-summary-note">{{ t.note }}</label>
              <textarea
                pTextarea
                id="lesson-summary-note"
                rows="3"
                maxlength="4000"
                [ngModel]="noteOf(only)"
                (ngModelChange)="setNote(only, $event)"
              ></textarea>
              <small class="tb-hint">{{ t.noteHint }}</small>
            </div>
          } @else {
            <div class="tb-field">
              <span>{{ t.notes }}</span>
              <ul class="tb-list">
                @for (participant of item.participants; track participant.studentId) {
                  <li class="tb-lesson-summary__note">
                    <button
                      type="button"
                      class="tb-lesson-summary__expand"
                      [attr.aria-expanded]="opened() === participant.studentId"
                      (click)="toggle(participant.studentId)"
                    >
                      <span class="tb-list__lead">
                        <tb-avatar
                          [name]="participant.studentName ?? ''"
                          [photo]="participant.studentAvatar"
                        />
                      </span>
                      <span class="tb-list__text">
                        <span class="tb-list__title">{{ participant.studentName }}</span>
                        @if (noteOf(participant.studentId) !== '') {
                          <span class="tb-list__supporting">{{
                            noteOf(participant.studentId)
                          }}</span>
                        }
                      </span>
                      <i
                        class="tb-i"
                        [class.tb-i-expand_less]="opened() === participant.studentId"
                        [class.tb-i-expand_more]="opened() !== participant.studentId"
                        aria-hidden="true"
                      ></i>
                    </button>
                    @if (opened() === participant.studentId) {
                      <textarea
                        pTextarea
                        rows="3"
                        maxlength="4000"
                        [attr.aria-label]="t.note + ': ' + participant.studentName"
                        [ngModel]="noteOf(participant.studentId)"
                        (ngModelChange)="setNote(participant.studentId, $event)"
                      ></textarea>
                    }
                  </li>
                }
              </ul>
              <small class="tb-hint">{{ t.noteHint }}</small>
            </div>
          }
        </div>
      }
      <ng-template tbDialogFooter>
        <p-button
          [label]="c.cancel"
          severity="secondary"
          [text]="true"
          [disabled]="submit.pending()"
          (onClick)="visible.set(false)"
        />
        <p-button
          [label]="t.save"
          severity="secondary"
          [disabled]="submit.pending() && sending()"
          [loading]="submit.pending() && !sending()"
          (onClick)="save(false)"
        />
        <p-button
          [label]="t.saveAndSend"
          [disabled]="summary().trim() === '' || (submit.pending() && !sending())"
          [loading]="submit.pending() && sending()"
          (onClick)="save(true)"
        />
      </ng-template>
    </tb-dialog>
  `,
  styles: `
    textarea {
      box-sizing: border-box;
      width: 100%;
      resize: vertical;
    }

    .tb-lesson-summary__draft {
      display: grid;
      gap: var(--tb-space-2);
      padding: var(--tb-space-3);
      border-radius: var(--tb-shape-lg);
      background: var(--p-md-surface-container-high);
    }

    .tb-lesson-summary__preview {
      min-height: 8rem;
    }

    .tb-lesson-summary__note {
      display: flex;
      flex-direction: column;
      align-items: stretch;
      gap: var(--tb-space-3);
    }

    .tb-lesson-summary__expand {
      display: flex;
      align-items: center;
      gap: var(--tb-space-3);
      width: 100%;
      padding: 0;
      border: 0;
      background: none;
      color: inherit;
      font: inherit;
      text-align: start;
      cursor: pointer;
    }
  `,
})
export class LessonSummaryDialog {
  protected readonly t = T.lessonSummary;
  protected readonly c = SHARED_T.common;
  private readonly api = inject(ScheduleApi);
  private readonly snackbar = inject(Snackbar);
  private readonly ai = inject(AiApi);
  private readonly homework = inject(HomeworkApi);

  readonly visible = model(false);
  readonly lesson = input<ScheduledLesson | null>(null);
  /** The lesson as the last write returned it (the summary and the notes are in it). */
  readonly saved = output<ScheduledLesson>();

  protected readonly modes = [
    { label: T.lessonSummary.write, value: 'edit' },
    { label: T.lessonSummary.preview, value: 'preview' },
  ];
  protected readonly mode = signal<SummaryMode>('edit');
  protected readonly opened = signal<string | null>(null);
  protected readonly sending = signal(false);

  // the AI draft: a few words of the teacher, the topic and the assignments given that day
  // read when the dialog first opens, so the cards that merely contain it ask nothing
  protected readonly aiEnabled = toSignal(
    toObservable(this.visible).pipe(
      filter(Boolean),
      take(1),
      switchMap(() => this.ai.enabled$),
    ),
    { initialValue: false },
  );
  protected readonly draftOpen = signal(false);
  protected readonly words = signal('');
  protected readonly drafting = signal(false);
  protected readonly drafted = signal(false);
  protected readonly error = signal<string | null>(null);
  private assignments: readonly AssignmentSummary[] | null = null;

  // the drafts are read again whenever the dialog opens
  protected readonly summary = linkedSignal(() => this.reset().summary);
  protected readonly nextPlan = linkedSignal(() => this.reset().nextPlan);
  private readonly notes = linkedSignal(() => this.reset().notes);
  private readonly reset = computed(() => {
    const lesson = this.visible() ? this.lesson() : null;
    return {
      summary: lesson?.summary ?? '',
      nextPlan: lesson?.nextPlan ?? '',
      notes: Object.fromEntries(
        (lesson?.notes ?? []).map((note): [string, string] => [note.studentId, note.note]),
      ),
    };
  });
  protected readonly dirty = computed(() => {
    const lesson = this.lesson();
    return (
      lesson !== null &&
      this.visible() &&
      (this.changedSummary(lesson) || this.changedNotes(lesson).length > 0)
    );
  });

  protected readonly submit = dialogSubmit({
    visible: this.visible,
    reset: () => {
      this.mode.set('edit');
      this.opened.set(null);
      this.draftOpen.set(false);
      this.words.set('');
      this.drafted.set(false);
      this.error.set(null);
    },
    failed: T.lessonSummary.failed,
    request: () => this.write(),
    done: (lesson) => {
      this.saved.emit(lesson);
      this.snackbar.success(this.sending() ? this.t.sent : this.t.saved);
    },
  });

  protected noteOf(studentId: string): string {
    return this.notes()[studentId] ?? '';
  }

  protected setNote(studentId: string, value: string): void {
    this.notes.update((notes) => ({ ...notes, [studentId]: value }));
  }

  protected toggleDraft(): void {
    this.draftOpen.update((open) => !open);
  }

  protected hasInput(lesson: ScheduledLesson): boolean {
    return (lesson.topic ?? '').trim() !== '' || this.words().trim() !== '';
  }

  /** The draft goes into «Что прошли»: it fills an empty field and follows the text already there. */
  protected draft(lesson: ScheduledLesson): void {
    if (this.drafting() || !this.hasInput(lesson)) {
      return;
    }
    this.drafting.set(true);
    this.error.set(null);
    this.givenAt(lesson)
      .pipe(
        switchMap((titles) =>
          this.ai.lessonSummary({
            topic: this.blankToNull(lesson.topic ?? ''),
            words: this.blankToNull(this.words()),
            assignmentTitles: titles,
          }),
        ),
      )
      .subscribe({
        next: ({ summary }) => {
          const current = this.summary().trim();
          this.summary.set(current === '' ? summary : `${current}\n\n${summary}`);
          this.mode.set('edit');
          this.drafted.set(true);
          this.drafting.set(false);
        },
        error: (failure: unknown) => {
          this.error.set(describeError(failure, this.t.draftFailed));
          this.drafting.set(false);
        },
      });
  }

  /**
   * Assignments are not bound to lessons: those given the same day to a student of the lesson are
   * taken as given at it. The list is read once; a failure just leaves the titles out.
   */
  private givenAt(lesson: ScheduledLesson): Observable<string[]> {
    const names = new Set(lesson.participants.map((participant) => participant.studentName));
    const day = new Date(lesson.startsAt).toDateString();
    const titles = (all: readonly AssignmentSummary[]): string[] =>
      all
        .filter(
          (assignment) =>
            new Date(assignment.createdAt).toDateString() === day &&
            assignment.students.some((student) => names.has(student)),
        )
        .map((assignment) => assignment.title)
        .slice(0, 20);
    if (this.assignments !== null) {
      return of(titles(this.assignments));
    }
    return this.homework.assignments().pipe(
      catchError(() => of([] as AssignmentSummary[])),
      switchMap((all) => {
        this.assignments = all;
        return of(titles(all));
      }),
    );
  }

  protected toggle(studentId: string): void {
    this.opened.update((current) => (current === studentId ? null : studentId));
  }

  protected save(send: boolean): void {
    if (send && this.summary().trim() === '') {
      return;
    }
    this.sending.set(send);
    this.submit.run();
  }

  /** Writes what changed, one request after another, and sends when asked; the last answer wins. */
  private write(): Observable<ScheduledLesson> {
    const lesson = this.lesson();
    if (lesson === null) {
      return EMPTY;
    }
    const steps: Observable<ScheduledLesson>[] = [];
    if (this.changedSummary(lesson)) {
      steps.push(
        this.api.updateSummary(
          lesson.id,
          this.blankToNull(this.summary()),
          this.blankToNull(this.nextPlan()),
        ),
      );
    }
    for (const studentId of this.changedNotes(lesson)) {
      steps.push(
        this.api.updateNote(lesson.id, studentId, this.blankToNull(this.noteOf(studentId))),
      );
    }
    const written = steps.length === 0 ? of(lesson) : concat(...steps).pipe(last());
    return this.sending()
      ? written.pipe(
          switchMap((result) =>
            this.api.shareSummary(lesson.id).pipe(
              last(),
              switchMap(() => of(result)),
            ),
          ),
        )
      : written;
  }

  private changedSummary(lesson: ScheduledLesson): boolean {
    return (
      this.summary().trim() !== (lesson.summary ?? '') ||
      this.nextPlan().trim() !== (lesson.nextPlan ?? '')
    );
  }

  private changedNotes(lesson: ScheduledLesson): string[] {
    return lesson.participants
      .map((participant) => participant.studentId)
      .filter((studentId) => {
        const saved = lesson.notes?.find((note) => note.studentId === studentId)?.note ?? '';
        return this.noteOf(studentId).trim() !== saved;
      });
  }

  private blankToNull(text: string): string | null {
    const trimmed = text.trim();
    return trimmed === '' ? null : trimmed;
  }
}
