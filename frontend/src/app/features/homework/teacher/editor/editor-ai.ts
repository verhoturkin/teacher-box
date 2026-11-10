import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { AppliedDraft, AppliedQuestions, HomeworkAiPanel, SourceOption } from '@features/ai/parts';

/**
 * The AI assistant of the assignment editor, the same in the supporting pane and in the modal drawer: it drafts
 * the text on «Задание» and the questions on «Тест» from the chosen sources.
 */
@Component({
  selector: 'tb-editor-ai',
  imports: [HomeworkAiPanel],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: contents' },
  template: `
    <tb-homework-ai-panel
      [pane]="true"
      [students]="students()"
      [compact]="compact()"
      (sourceAdd)="sourceAdd.emit()"
      [title]="title()"
      [hasText]="hasText()"
      [sources]="sources()"
      [questionCount]="questionCount()"
      [quizLocked]="quizLocked()"
      (applied)="applied.emit($event)"
      (questionsApplied)="questionsApplied.emit($event)"
    />
  `,
})
export class EditorAi {
  /** Whose AI tags the assistant takes. */
  readonly students = input.required<readonly string[]>();
  readonly compact = input(false);
  readonly title = input.required<string>();
  readonly hasText = input.required<boolean>();
  readonly sources = input.required<readonly SourceOption[]>();
  readonly questionCount = input.required<number>();
  readonly quizLocked = input.required<boolean>();

  /** «Добавить источник»: a textbook to bind. */
  readonly sourceAdd = output();
  readonly applied = output<AppliedDraft>();
  readonly questionsApplied = output<AppliedQuestions>();
}
