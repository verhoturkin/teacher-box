import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { SKIP_ERROR_TOAST } from '@core/http/api-error.interceptor';
import { aiStatus } from '@testing/ai-fixtures';
import { AiApi } from './ai-api';

describe('AiApi', () => {
  let api: AiApi;
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    api = TestBed.inject(AiApi);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    backend.verify();
  });

  it('loads the availability once and shares it', async () => {
    const first = firstValueFrom(api.enabled$);
    const request = backend.expectOne('/api/teacher/ai/status');
    expect(request.request.context.get(SKIP_ERROR_TOAST)).toBe(true);
    request.flush(aiStatus());

    expect(await first).toBe(true);
    expect(await firstValueFrom(api.enabled$)).toBe(true);
    backend.expectNone('/api/teacher/ai/status');
  });

  it('treats a failed status request as disabled', async () => {
    const enabled = firstValueFrom(api.enabled$);
    backend.expectOne('/api/teacher/ai/status').flush(null, { status: 403, statusText: 'Forbidden' });

    expect(await enabled).toBe(false);
  });

  it('calls the assistant endpoints', () => {
    api.status().subscribe();
    api.homeworkDraft({ topic: 'Дроби', level: null, taskCount: 3, wishes: null }).subscribe();
    api.reviewDraft({ title: 'Дроби', description: null, answer: '2/5' }).subscribe();
    api.usage().subscribe();
    api.usage('2026-08').subscribe();

    backend.expectOne('/api/teacher/ai/status');
    const draft = backend.expectOne('/api/teacher/ai/homework-draft');
    expect(draft.request.body).toEqual({ topic: 'Дроби', level: null, taskCount: 3, wishes: null });
    expect(draft.request.context.get(SKIP_ERROR_TOAST)).toBe(true);
    expect(backend.expectOne('/api/teacher/ai/review-draft').request.body).toEqual({
      title: 'Дроби',
      description: null,
      answer: '2/5',
    });
    backend.expectOne('/api/teacher/ai/usage');
    backend.expectOne('/api/teacher/ai/usage?month=2026-08');
  });
});
