import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  linkedSignal,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Button } from 'primeng/button';
import { SelectButton } from 'primeng/selectbutton';
import { Textarea } from 'primeng/textarea';
import { Snackbar } from '@core/snackbar/snackbar';
import { Avatar } from '@shared/ui/avatar';
import { Busy } from '@shared/ui/busy';
import { MarkdownView } from '@shared/ui/markdown-view';
import { ScheduleApi } from '../data-access/schedule-api';
import { ScheduledLesson } from '../data-access/schedule.models';
import { T } from '../i18n/texts';

type SummaryMode = 'edit' | 'preview';
type SaveState = 'idle' | 'saving' | 'saved' | 'failed';

/**
 * The «Итоги» section of the teacher's lesson card: «Что прошли» (Markdown, `Текст / Просмотр` as in the
 * homework editor), «Что дальше» and the private «Заметка для себя» (one per student; a group lesson
 * lists the students, each folds open). Every field saves when it loses focus and the line under the
 * section says so; «Отправить ученику» tells the participants. The host shows the section of a lesson
 * that is not cancelled.
 */
@Component({
  selector: 'tb-lesson-summary',
  imports: [FormsModule, Button, SelectButton, Textarea, Avatar, MarkdownView],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let item = lesson();
    <section class="tb-lesson-summary" [attr.aria-labelledby]="'summary-title-' + item.id">
      <h3 class="tb-lesson-summary__title" [id]="'summary-title-' + item.id">{{ t.title }}</h3>

      <div class="tb-field">
        <div class="tb-field__header">
          <label [for]="'summary-' + item.id">{{ t.covered }}</label>
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
            class="tb-lesson-summary__text"
            [id]="'summary-' + item.id"
            rows="5"
            maxlength="4000"
            [ngModel]="summary()"
            (ngModelChange)="summary.set($event)"
            (blur)="saveSummary()"
          ></textarea>
        }
        <small class="tb-hint">{{ t.coveredHint }}</small>
      </div>

      <div class="tb-field">
        <label [for]="'next-' + item.id">{{ t.nextPlan }}</label>
        <textarea
          pTextarea
          [id]="'next-' + item.id"
          rows="2"
          maxlength="1000"
          [ngModel]="nextPlan()"
          (ngModelChange)="nextPlan.set($event)"
          (blur)="saveSummary()"
        ></textarea>
        <small class="tb-hint">{{ t.nextPlanHint }}</small>
      </div>

      @if (item.participants.length > 0) {
        @if (item.groupId === null) {
          @let only = item.participants[0]?.studentId ?? '';
          <div class="tb-field">
            <label [for]="'note-' + item.id">{{ t.note }}</label>
            <textarea
              pTextarea
              [id]="'note-' + item.id"
              rows="3"
              maxlength="4000"
              [ngModel]="noteOf(only)"
              (ngModelChange)="setNote(only, $event)"
              (blur)="saveNote(only)"
            ></textarea>
            <small class="tb-hint">{{ t.noteHint }}</small>
          </div>
        } @else {
          <h4 class="tb-lesson-summary__subtitle">{{ t.notes }}</h4>
          <ul class="tb-list tb-lesson-summary__notes">
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
                      <span class="tb-list__supporting">{{ noteOf(participant.studentId) }}</span>
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
                  <div class="tb-field tb-lesson-summary__note-field">
                    <textarea
                      pTextarea
                      rows="3"
                      maxlength="4000"
                      [attr.aria-label]="t.note + ': ' + participant.studentName"
                      [ngModel]="noteOf(participant.studentId)"
                      (ngModelChange)="setNote(participant.studentId, $event)"
                      (blur)="saveNote(participant.studentId)"
                    ></textarea>
                    <small class="tb-hint">{{ t.noteHint }}</small>
                  </div>
                }
              </li>
            }
          </ul>
        }
      }

      <div class="tb-lesson-summary__footer">
        <span class="tb-lesson-summary__state" role="status" aria-live="polite">{{
          stateText()
        }}</span>
        <p-button
          icon="tb-i tb-i-send"
          severity="secondary"
          [label]="item.groupId === null ? t.send : t.sendGroup"
          [disabled]="!canSend()"
          [loading]="busy.is('send')"
          [title]="canSend() ? '' : t.sendDisabled"
          (onClick)="send()"
        />
      </div>
    </section>
  `,
  styles: `
    .tb-lesson-summary {
      display: flex;
      flex-direction: column;
      gap: var(--tb-space-4);
      padding-top: var(--tb-space-4);
    }

    .tb-lesson-summary__title,
    .tb-lesson-summary__subtitle {
      margin: 0;
      color: var(--p-md-on-surface);
      font: var(--tb-type-title-m);
    }

    .tb-lesson-summary__subtitle {
      color: var(--p-md-on-surface-variant);
      font: var(--tb-type-label-l);
    }

    .tb-lesson-summary__text {
      width: 100%;
    }

    .tb-lesson-summary__preview {
      min-height: 8rem;
    }

    .tb-lesson-summary__note {
      display: flex;
      flex-direction: column;
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

    .tb-lesson-summary__note-field {
      padding-top: var(--tb-space-3);
    }

    .tb-lesson-summary__footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--tb-space-3);
    }

    .tb-lesson-summary__state {
      color: var(--p-md-on-surface-variant);
      font: var(--tb-type-body-s);
    }
  `,
})
export class LessonSummary {
  protected readonly t = T.lessonSummary;
  private readonly api = inject(ScheduleApi);
  private readonly snackbar = inject(Snackbar);
  protected readonly busy = new Busy();

  readonly lesson = input.required<ScheduledLesson>();
  /** The lesson as the last save returned it. */
  readonly changed = output<ScheduledLesson>();

  protected readonly modes = [
    { label: T.lessonSummary.write, value: 'edit' },
    { label: T.lessonSummary.preview, value: 'preview' },
  ];
  protected readonly mode = signal<SummaryMode>('edit');
  protected readonly opened = signal<string | null>(null);
  protected readonly state = signal<SaveState>('idle');

  // the drafts follow the lesson being shown, not each save: a field being typed in is never reset
  protected readonly summary = linkedSignal({
    source: () => this.lesson().id,
    computation: () => this.lesson().summary ?? '',
  });
  protected readonly nextPlan = linkedSignal({
    source: () => this.lesson().id,
    computation: () => this.lesson().nextPlan ?? '',
  });
  private readonly notes = linkedSignal<string, Record<string, string>>({
    source: () => this.lesson().id,
    computation: () =>
      Object.fromEntries((this.lesson().notes ?? []).map((note) => [note.studentId, note.note])),
  });

  /** What the last save holds: the button sends that text, never an unsaved one. */
  protected readonly canSend = computed(
    () => (this.lesson().summary ?? '').trim() !== '' && this.state() !== 'saving',
  );
  protected readonly stateText = computed(() => {
    switch (this.state()) {
      case 'saving':
        return this.t.saving;
      case 'saved':
        return this.t.saved;
      case 'failed':
        return this.t.failed;
      case 'idle':
        return '';
    }
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

  protected saveSummary(): void {
    const lesson = this.lesson();
    const summary = this.summary().trim();
    const nextPlan = this.nextPlan().trim();
    if (summary === (lesson.summary ?? '') && nextPlan === (lesson.nextPlan ?? '')) {
      return;
    }
    this.persist(
      this.api.updateSummary(
        lesson.id,
        summary === '' ? null : summary,
        nextPlan === '' ? null : nextPlan,
      ),
    );
  }

  protected saveNote(studentId: string): void {
    const lesson = this.lesson();
    const note = this.noteOf(studentId).trim();
    const saved = lesson.notes?.find((candidate) => candidate.studentId === studentId)?.note ?? '';
    if (note === saved) {
      return;
    }
    this.persist(this.api.updateNote(lesson.id, studentId, note === '' ? null : note));
  }

  protected send(): void {
    this.busy.guard('send', this.api.shareSummary(this.lesson().id)).subscribe({
      next: () => {
        this.snackbar.success(this.t.sent);
      },
      error: () => {
        this.snackbar.error(this.t.sendFailed);
      },
    });
  }

  private persist(request: ReturnType<ScheduleApi['updateSummary']>): void {
    this.state.set('saving');
    request.subscribe({
      next: (updated) => {
        this.state.set('saved');
        this.changed.emit(updated);
      },
      error: () => {
        this.state.set('failed');
      },
    });
  }
}
