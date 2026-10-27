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
import { FormsModule } from '@angular/forms';
import { EMPTY, Observable, concat, last, of, switchMap } from 'rxjs';
import { Button } from 'primeng/button';
import { SelectButton } from 'primeng/selectbutton';
import { Textarea } from 'primeng/textarea';
import { Snackbar } from '@core/snackbar/snackbar';
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
              <!-- 307.2: the button of the AI draft goes here, before the toggle -->
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
          [label]="lesson()?.groupId === null ? t.saveAndSend : t.saveAndSendGroup"
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
