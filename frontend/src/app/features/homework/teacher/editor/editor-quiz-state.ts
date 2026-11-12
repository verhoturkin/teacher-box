import { signal } from '@angular/core';
import { AppliedQuestions } from '@features/ai/parts';
import {
  AssignmentDetails,
  AssignmentInput,
  QuizReveal,
} from '@features/homework/data-access/homework.models';
import {
  MAX_QUESTIONS,
  QuestionDraft,
  firstProblem,
  questionDraft,
  questionInputs,
} from '../question-drafts';

/** The quiz of the assignment editor (ADR-0052): its questions, how it goes and what the teacher did to it. */
export class EditorQuizState {
  /** The questions of the quiz; saved with the assignment. */
  readonly questions = signal<readonly QuestionDraft[]>([]);
  readonly reveal = signal<QuizReveal>('AFTER_SUBMIT');
  /** 0 — unlimited. */
  readonly attempts = signal(1);
  /** The teacher changed the quiz: leaving asks and the quiz is sent. */
  readonly changed = signal(false);
  /** A student started the quiz: the questions can no longer change. */
  readonly locked = signal(false);
  readonly error = signal<string | null>(null);
  /** A save was tried: each question says what is wrong with it. */
  readonly checked = signal(false);

  /** The quiz as saved. */
  load(assignment: AssignmentDetails): void {
    this.questions.set(drafts(assignment));
    this.reveal.set(assignment.quizReveal);
    this.attempts.set(assignment.quizAttempts ?? 0);
    // a finished attempt shows the quiz was started; a started one only the server knows (homework.quiz-started)
    this.locked.set(assignment.tasks.some((task) => task.quizScore !== null));
  }

  /** Another assignment opens in the page: nothing is changed, checked or locked yet. */
  reset(): void {
    this.locked.set(false);
    this.checked.set(false);
    this.error.set(null);
    this.changed.set(false);
  }

  changeQuestions(questions: readonly QuestionDraft[]): void {
    this.questions.set(questions);
    this.changed.set(true);
  }

  changeReveal(reveal: QuizReveal): void {
    this.reveal.set(reveal);
    this.changed.set(true);
  }

  changeAttempts(attempts: number): void {
    this.attempts.set(attempts);
    this.changed.set(true);
  }

  /** AI questions go into the quiz; the teacher reviews them in the questions card before saving. */
  apply({ questions, mode }: AppliedQuestions): void {
    const drafted = questions.map((question) => questionDraft(question.type, question));
    this.changeQuestions(
      (mode === 'replace' ? drafted : [...this.questions(), ...drafted]).slice(0, MAX_QUESTIONS),
    );
  }

  /** Some question is not ready to be given out; a locked quiz is not checked. */
  hasProblems(): boolean {
    return !this.locked() && firstProblem(this.questions()) !== null;
  }

  /** The server has the questions as they were: show those, read-only. */
  lock(saved: AssignmentDetails | null): void {
    this.locked.set(true);
    if (saved !== null) {
      this.questions.set(drafts(saved));
    }
  }

  /** What a save sends of the quiz: only a changed one, and its questions only while it is not locked. */
  input(): Pick<AssignmentInput, 'questions' | 'quizReveal' | 'quizAttempts'> {
    if (!this.changed()) {
      return {};
    }
    return {
      ...(this.locked() ? {} : { questions: questionInputs(this.questions()) }),
      quizReveal: this.reveal(),
      quizAttempts: this.attempts(),
    };
  }
}

function drafts(assignment: AssignmentDetails): QuestionDraft[] {
  return assignment.questions.map((question) => questionDraft(question.type, question));
}
