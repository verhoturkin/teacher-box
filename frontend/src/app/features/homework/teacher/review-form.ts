import { computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { AiApi } from '@features/ai/parts';
import { HomeworkApi } from '../data-access/homework-api';
import { ReviewDecision, TaskDetails } from '../data-access/homework.models';
import { T } from '../i18n/texts';

export interface ReviewSuggestion {
  readonly comment: string;
  readonly grade: string | null;
  readonly decision: ReviewDecision;
}

/** Shared review state; each surface decides when to insert a draft and how to show the result. */
export class ReviewForm {
  private readonly api = inject(HomeworkApi);
  private readonly ai = inject(AiApi);
  readonly aiEnabled = toSignal(this.ai.enabled$, { initialValue: false });
  readonly pending = signal(false);
  readonly drafting = signal(false);
  readonly form = new FormGroup({
    grade: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(20)] }),
    comment: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(5000)] }),
  });
  readonly commentValue = toSignal(this.form.controls.comment.valueChanges, { initialValue: '' });
  private readonly gradeValue = toSignal(this.form.controls.grade.valueChanges, {
    initialValue: '',
  });
  readonly reviewText = computed(() => {
    const grade = this.gradeValue().trim();
    return grade === ''
      ? this.commentValue()
      : `${T.review.gradeLine(grade)}\n\n${this.commentValue()}`;
  });

  latestAnswer(task: TaskDetails): string | null {
    return (
      task.submissions.find((submission) => (submission.text ?? '').trim() !== '')?.text ?? null
    );
  }

  reset(task: TaskDetails): void {
    this.form.reset({
      grade: task.grade ?? task.quiz?.suggestedGrade ?? '',
      comment: task.teacherComment ?? '',
    });
  }

  /** The same work changed (a verdict on an answer): the suggested grade follows unless the teacher typed one. */
  refresh(previous: TaskDetails, task: TaskDetails): void {
    const grade = this.form.controls.grade;
    if (grade.value === '' || grade.value === previous.quiz?.suggestedGrade) {
      grade.setValue(task.grade ?? task.quiz?.suggestedGrade ?? '');
    }
  }

  submit(task: TaskDetails, decision: ReviewDecision, saved: (task: TaskDetails) => void): void {
    if (this.pending()) {
      return;
    }
    const { grade, comment } = this.form.getRawValue();
    this.pending.set(true);
    this.api
      .review(
        task.taskId,
        decision,
        grade.trim() === '' ? null : grade.trim(),
        comment.trim() === '' ? null : comment,
      )
      .subscribe({
        next: (reviewed) => {
          this.pending.set(false);
          saved(reviewed);
        },
        error: () => {
          this.pending.set(false);
        },
      });
  }

  draft(task: TaskDetails, received: (draft: ReviewSuggestion) => void): void {
    const answer = this.latestAnswer(task);
    if (answer === null || this.drafting()) {
      return;
    }
    this.drafting.set(true);
    this.ai
      .reviewDraft({
        title: task.assignment.title,
        description: task.assignment.description,
        answer,
      })
      .subscribe({
        next: (draft) => {
          this.drafting.set(false);
          received({
            comment: draft.comment,
            grade: draft.grade,
            decision: draft.accept ? 'ACCEPT' : 'RETURN',
          });
        },
        error: () => {
          this.drafting.set(false);
        },
      });
  }
}
