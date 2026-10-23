import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { taskDetails } from '@testing/homework-fixtures';
import { testProviders } from '@testing/setup';
import { ReviewForm } from './review-form';

describe('ReviewForm', () => {
  it('normalizes a review, guards duplicate submissions and keeps the form after failure', () => {
    TestBed.configureTestingModule({ providers: testProviders() });
    const review = TestBed.runInInjectionContext(() => new ReviewForm());
    const backend = TestBed.inject(HttpTestingController);
    backend.expectOne('/api/teacher/ai/status').flush({ enabled: false });
    const task = taskDetails();
    const saved = vi.fn();
    review.form.setValue({ grade: ' 5 ', comment: ' Keep my spaces ' });
    review.submit(task, 'ACCEPT', saved);
    review.submit(task, 'ACCEPT', saved);
    const request = backend.expectOne(`/api/teacher/homework/tasks/${task.taskId}/review`);
    expect(request.request.body).toEqual({
      decision: 'ACCEPT',
      grade: '5',
      comment: ' Keep my spaces ',
    });
    expect(review.pending()).toBe(true);
    request.flush(null, { status: 422, statusText: 'Unprocessable' });
    expect(review.pending()).toBe(false);
    expect(review.form.getRawValue()).toEqual({ grade: ' 5 ', comment: ' Keep my spaces ' });
    expect(saved).not.toHaveBeenCalled();

    review.form.setValue({ grade: ' ', comment: '\n ' });
    review.submit(task, 'RETURN', saved);
    const retry = backend.expectOne(`/api/teacher/homework/tasks/${task.taskId}/review`);
    expect(retry.request.body).toEqual({ decision: 'RETURN', grade: null, comment: null });
    retry.flush(task);
    expect(review.pending()).toBe(false);
    expect(saved).toHaveBeenCalledWith(task);
    backend.verify();
  });
});
