import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { SKIP_ERROR_TOAST } from '@core/http/api-error.interceptor';
import { aiStatus } from '@testing/ai-fixtures';
import { AiApi } from './ai-api';
import { testProviders } from '@testing/setup';

describe('AiApi', () => {
  let api: AiApi;
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: testProviders(),
    });
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
    backend
      .expectOne('/api/teacher/ai/status')
      .flush(null, { status: 403, statusText: 'Forbidden' });

    expect(await enabled).toBe(false);
  });

  it('sends picked files with the brief as a form', async () => {
    const brief = { prompt: 'По скану', title: null, sources: [] };
    const scan = new File(['png'], 'Скан.png', { type: 'image/png' });
    api.homeworkDraft(brief, [scan]).subscribe();

    const body: unknown = backend.expectOne('/api/teacher/ai/homework-draft').request.body;
    if (!(body instanceof FormData)) {
      throw new Error('a form is expected');
    }
    const json = body.get('brief');
    if (!(json instanceof Blob)) {
      throw new Error('a JSON part is expected');
    }
    expect(json.type).toBe('application/json');
    expect(JSON.parse(await json.text())).toEqual(brief);
    expect(body.getAll('files')).toEqual([scan]);
  });

  it('calls the assistant endpoints', () => {
    api.status().subscribe();
    const brief = {
      prompt: 'Дроби',
      title: null,
      sources: [],
    };
    api.homeworkDraft(brief).subscribe();
    const input = { title: 'Тест', text: 'Сделай тест' };
    api.prompts().subscribe();
    api.savePrompt(input).subscribe();
    api.updatePrompt('p-1', input, 2).subscribe();
    api.deletePrompt('p-1').subscribe();
    api.reviewDraft({ title: 'Дроби', description: null, answer: '2/5' }).subscribe();
    api.usage().subscribe();
    api.usage('2026-08').subscribe();
    api.requests('2026-08', 10).subscribe();
    api.systemPrompts().subscribe();
    api.updateSystemPrompt('REVIEW_DRAFT', 'Строго', 1).subscribe();
    api.resetSystemPrompt('REVIEW_DRAFT').subscribe();

    backend.expectOne('/api/teacher/ai/status');
    const draft = backend.expectOne('/api/teacher/ai/homework-draft');
    expect(draft.request.body).toEqual(brief);
    backend.expectOne({ method: 'GET', url: '/api/teacher/ai/prompts' });
    expect(
      backend.expectOne({ method: 'POST', url: '/api/teacher/ai/prompts' }).request.body,
    ).toEqual(input);
    expect(
      backend.expectOne({ method: 'PUT', url: '/api/teacher/ai/prompts/p-1' }).request.body,
    ).toEqual({
      ...input,
      version: 2,
    });
    backend.expectOne({ method: 'DELETE', url: '/api/teacher/ai/prompts/p-1' });
    expect(draft.request.context.get(SKIP_ERROR_TOAST)).toBe(true);
    expect(backend.expectOne('/api/teacher/ai/review-draft').request.body).toEqual({
      title: 'Дроби',
      description: null,
      answer: '2/5',
    });
    backend.expectOne('/api/teacher/ai/usage');
    backend.expectOne('/api/teacher/ai/usage?month=2026-08');
    backend.expectOne('/api/teacher/ai/requests?month=2026-08&offset=10');
    backend.expectOne({ method: 'GET', url: '/api/teacher/ai/system-prompts' });
    expect(
      backend.expectOne({ method: 'PUT', url: '/api/teacher/ai/system-prompts/REVIEW_DRAFT' })
        .request.body,
    ).toEqual({ text: 'Строго', version: 1 });
    backend.expectOne({ method: 'DELETE', url: '/api/teacher/ai/system-prompts/REVIEW_DRAFT' });
  });
});
