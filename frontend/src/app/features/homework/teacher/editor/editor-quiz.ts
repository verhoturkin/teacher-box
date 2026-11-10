import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { QuizAnswer, QuizReveal } from '@features/homework/data-access/homework.models';
import { T } from '@features/homework/i18n/texts';
import { QuizPlayer } from '@features/homework/student/quiz-player';
import { QuestionDraft, asStudentSees, questionInputs } from '../question-drafts';
import { QuestionSection } from '../question-section';

/**
 * «Тест» of the assignment editor (ADR-0052): the questions and how the test goes, and «Как увидит ученик» — the
 * full-screen test with these questions, whose answers are never saved.
 */
@Component({
  selector: 'tb-editor-quiz',
  imports: [QuestionSection, QuizPlayer],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: contents' },
  template: `
    <tb-question-section
      id="editor-quiz"
      [questions]="questions()"
      (questionsChange)="questionsChange.emit($event)"
      [reveal]="reveal()"
      (revealChange)="revealChange.emit($event)"
      [attempts]="attempts()"
      (attemptsChange)="attemptsChange.emit($event)"
      [locked]="locked()"
      [error]="error()"
      [showProblems]="showProblems()"
      [compact]="compact()"
      [single]="single()"
      [status]="status()"
      (ai)="ai.emit()"
      (copyQuiz)="copyQuiz.emit()"
    />
    <tb-quiz-player
      [(visible)]="studentView"
      [questions]="studentQuestions()"
      [(answers)]="studentAnswers"
      [title]="tt.testTitle(title())"
      [subtitle]="t.studentViewNote"
      [exitLabel]="t.studentViewClose"
      (finished)="studentView.set(false)"
    />
  `,
})
export class EditorQuiz {
  protected readonly t = T.editor;
  protected readonly tt = T.quizTake;

  readonly questions = input.required<readonly QuestionDraft[]>();
  readonly reveal = input.required<QuizReveal>();
  /** 0 — unlimited. */
  readonly attempts = input.required<number>();
  /** A student started the quiz: the questions can no longer change. */
  readonly locked = input.required<boolean>();
  readonly error = input.required<string | null>();
  /** A save was tried: each question says what is wrong with it. */
  readonly showProblems = input.required<boolean>();
  readonly compact = input.required<boolean>();
  readonly single = input.required<boolean>();
  /** «сохранено · HH:mm» under a question full screen on a phone. */
  readonly status = input.required<string | null>();
  /** The assignment's title, on top of the student's view. */
  readonly title = input.required<string>();

  readonly questionsChange = output<readonly QuestionDraft[]>();
  readonly revealChange = output<QuizReveal>();
  readonly attemptsChange = output<number>();
  /** «С ИИ»: the assistant drafts questions. */
  readonly ai = output();
  /** «Создать копию для правок» of a locked quiz. */
  readonly copyQuiz = output();

  /** «Как увидит ученик»: the full-screen test with the editor's questions; the answers stay here. */
  protected readonly studentView = signal(false);
  protected readonly studentAnswers = signal<Readonly<Record<string, QuizAnswer>>>({});
  protected readonly studentQuestions = computed(() =>
    asStudentSees(questionInputs(this.questions())),
  );

  /** Opens the student's view with no answers. */
  openStudentView(): void {
    this.studentAnswers.set({});
    this.studentView.set(true);
  }
}
