import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { testProviders } from '@testing/setup';
import { aLessonPlan } from '@testing/textbooks-fixtures';
import { LessonPlansApi } from './lesson-plans-api';

describe('LessonPlansApi', () => {
  let api: LessonPlansApi;
  let backend: HttpTestingController;
  const input = { title: 'A2', body: '', courseId: null, textbooks: [], videos: [] };

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: testProviders() });
    api = TestBed.inject(LessonPlansApi);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    backend.verify();
  });

  it('lists the bank and the working plans, reads, creates, updates and deletes a plan', () => {
    api.list(true).subscribe();
    backend.expectOne({ method: 'GET', url: '/api/teacher/textbooks/plans?bank=true' }).flush([]);
    api.list(false).subscribe();
    backend.expectOne({ method: 'GET', url: '/api/teacher/textbooks/plans' }).flush([]);

    let read: unknown;
    api.get('p-1').subscribe((plan) => (read = plan));
    backend.expectOne('/api/teacher/textbooks/plans/p-1').flush(aLessonPlan());
    expect(read).toEqual(aLessonPlan());

    api.create(input, true).subscribe();
    const created = backend.expectOne({ method: 'POST', url: '/api/teacher/textbooks/plans' });
    expect(created.request.body).toEqual({ ...input, bank: true });
    created.flush(aLessonPlan());

    api.update({ id: 'p-1', version: 4 }, input).subscribe();
    const updated = backend.expectOne({ method: 'PUT', url: '/api/teacher/textbooks/plans/p-1' });
    expect(updated.request.body).toEqual({ ...input, version: 4 });
    updated.flush(aLessonPlan());

    let removed = false;
    api.remove('p-1').subscribe(() => (removed = true));
    backend.expectOne({ method: 'DELETE', url: '/api/teacher/textbooks/plans/p-1' }).flush(null);
    expect(removed).toBe(true);
  });

  it('finishes a plan and saves it into the bank', () => {
    api.finish('p-1').subscribe();
    backend
      .expectOne({ method: 'POST', url: '/api/teacher/textbooks/plans/p-1/finish' })
      .flush(aLessonPlan());
    api.saveToBank('p-1').subscribe();
    backend
      .expectOne({ method: 'POST', url: '/api/teacher/textbooks/plans/p-1/bank' })
      .flush(aLessonPlan());
  });

  it('uses a bank item for a lesson', () => {
    let used: unknown;
    api.use('p-1', 'l-1').subscribe((answer) => (used = answer));
    const request = backend.expectOne({
      method: 'POST',
      url: '/api/teacher/textbooks/plans/p-1/use',
    });
    expect(request.request.body).toEqual({ lessonId: 'l-1' });
    request.flush({ lessonId: 'l-1', plan: aLessonPlan({ id: 'p-2', bank: false }) });
    expect(used).toEqual({ lessonId: 'l-1', plan: aLessonPlan({ id: 'p-2', bank: false }) });
  });
});
