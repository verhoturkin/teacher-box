import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { T } from '@features/homework/i18n/texts';
import { QUESTION_ICONS, QuestionDraft } from '../question-drafts';

/** Questions on the summary card of «Задание». */
const SUMMARY_QUESTIONS = 3;

/** The test summed up on «Задание»: the first questions, their points and «Открыть тест». */
@Component({
  selector: 'tb-editor-quiz-summary',
  imports: [Button, Card],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: contents' },
  template: `
    <p-card id="editor-quiz-summary" styleClass="tb-section-card" class="tb-editor__quiz">
      <div class="tb-editor__card-head">
        <h2 class="tb-subtitle">{{ t.quizTitle }}</h2>
        <span class="tb-hint">{{ summary() }}</span>
      </div>
      <ul class="tb-list tb-list--no-lead" [attr.aria-label]="t.quizTitle">
        @for (question of first(); track question.id; let index = $index) {
          <li>
            <span class="tb-editor__quiz-row">
              <b>{{ index + 1 }}</b>
              <i
                class="tb-i {{ icons[question.type] }}"
                aria-hidden="true"
                [title]="tq.types[question.type]"
              ></i>
              <span class="tb-editor__quiz-text">{{
                question.text.trim() || t.untitledQuestion
              }}</span>
            </span>
            <span class="tb-list__trail tb-hint">{{ question.points }}</span>
          </li>
        }
        @if (questions().length > first().length) {
          <li>
            <span class="tb-editor__quiz-row tb-hint">{{
              t.quizMore(questions().length - first().length)
            }}</span>
          </li>
        }
      </ul>
      <p class="tb-hint">{{ t.quizWhere }}</p>
      <p-button
        [label]="t.openQuiz"
        icon="tb-i tb-i-edit"
        severity="secondary"
        (onClick)="open.emit()"
      />
    </p-card>
  `,
  styles: `
    .tb-editor__card-head {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      justify-content: space-between;
      gap: var(--tb-space-2) var(--tb-space-4);
      margin-block-end: var(--tb-space-3);
    }

    /* one line: the number, the type icon and the text; the points are the row's trail */
    .tb-editor__quiz-row {
      grid-area: text;
      display: flex;
      align-items: center;
      gap: var(--tb-space-3);
      min-width: 0;
    }

    .tb-editor__quiz-row .tb-i {
      color: var(--p-md-primary);
      font-size: 1.25rem;
    }

    .tb-editor__quiz-text {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  `,
})
export class EditorQuizSummary {
  protected readonly t = T.editor;
  protected readonly tq = T.quiz;
  protected readonly icons = QUESTION_ICONS;

  readonly questions = input.required<readonly QuestionDraft[]>();
  /** 0 — unlimited. */
  readonly attempts = input.required<number>();
  /** «Открыть тест». */
  readonly open = output();

  /** The first questions on the card. */
  protected readonly first = computed(() => this.questions().slice(0, SUMMARY_QUESTIONS));
  protected readonly summary = computed(() =>
    T.editor.quizSummary(
      this.questions().length,
      this.questions().reduce((sum, question) => sum + question.points, 0),
      this.attempts(),
    ),
  );
}
