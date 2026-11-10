import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { aiModel, aiProvider, answerModels } from '@testing/ai-fixtures';
import { submission, taskDetails } from '@testing/homework-fixtures';
import { AiModelChoice } from '@features/ai/parts';
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
  it('drafts a review with the model picked on this device', () => {
    localStorage.setItem('tb.ai.model', 'm-2');
    TestBed.configureTestingModule({ providers: testProviders() });
    const review = TestBed.runInInjectionContext(() => new ReviewForm());
    const backend = TestBed.inject(HttpTestingController);
    backend.expectOne('/api/teacher/ai/status').flush({ enabled: true });
    TestBed.inject(AiModelChoice).load();
    answerModels(backend, [
      aiProvider({ models: [aiModel(), aiModel({ id: 'm-2', default: false })] }),
    ]);
    const task = taskDetails({ submissions: [submission({ text: 'Ответ' })] });
    const received = vi.fn();

    review.draft(task, received);
    const request = backend.expectOne('/api/teacher/ai/review-draft');
    expect(request.request.body).toMatchObject({ answer: 'Ответ', modelId: 'm-2' });
    request.flush({ comment: 'Хорошо', grade: '5', accept: true });
    expect(received).toHaveBeenCalledWith({ comment: 'Хорошо', grade: '5', decision: 'ACCEPT' });
    backend.verify();
    localStorage.removeItem('tb.ai.model');
  });
});
