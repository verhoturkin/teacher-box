import { HttpClient } from '@angular/common/http';
import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { aiModel, aiProvider, answerModels } from '@testing/ai-fixtures';
import { testProviders } from '@testing/setup';
import { MODEL_CHOICE_KEY, AiModelChoice } from './model-choice';

const PROVIDERS = '/api/teacher/ai/providers';
const opus = aiModel();
const sonnet = aiModel({ id: 'm-2', label: 'Claude Sonnet 5', default: false });
const deepseek = aiModel({ id: 'm-3', label: 'DeepSeek V4', default: false });

describe('AiModelChoice', () => {
  let backend: HttpTestingController;
  let choice: AiModelChoice;

  function start(stored: string | null): void {
    localStorage.removeItem(MODEL_CHOICE_KEY);
    if (stored !== null) {
      localStorage.setItem(MODEL_CHOICE_KEY, stored);
    }
    TestBed.configureTestingModule({ providers: testProviders() });
    backend = TestBed.inject(HttpTestingController);
    choice = TestBed.inject(AiModelChoice);
  }

  afterEach(() => {
    backend.verify();
    localStorage.removeItem(MODEL_CHOICE_KEY);
  });

  it('writes with the default model until another is picked, and keeps only the other one', () => {
    start(null);
    choice.load();
    choice.load();
    answerModels(backend, [aiProvider({ models: [opus, sonnet] })]);
    choice.load();
    backend.expectNone(PROVIDERS);

    expect(choice.chosen()?.label).toBe('Claude Opus 5');
    choice.choose(sonnet);
    expect(choice.chosen()?.label).toBe('Claude Sonnet 5');
    expect(localStorage.getItem(MODEL_CHOICE_KEY)).toBe('m-2');

    choice.choose(opus);
    expect(choice.chosen()?.label).toBe('Claude Opus 5');
    expect(localStorage.getItem(MODEL_CHOICE_KEY)).toBeNull();
  });

  it('forgets a removed model and passes over one of a broken connection', () => {
    start('gone');
    choice.load();
    answerModels(backend, [aiProvider({ models: [opus] })]);
    expect(localStorage.getItem(MODEL_CHOICE_KEY)).toBeNull();

    choice.invalidate();
    choice.choose(deepseek);
    choice.load();
    answerModels(backend, [
      aiProvider({ models: [opus] }),
      aiProvider({ id: 'pr-2', state: 'FAILED', models: [deepseek] }),
    ]);
    expect(choice.chosen()?.label).toBe('Claude Opus 5');
    expect(localStorage.getItem(MODEL_CHOICE_KEY)).toBe('m-3');
  });

  it('stays without models when the connections cannot be read, and tries again', () => {
    start(null);
    choice.load();
    backend.expectOne(PROVIDERS).flush(null, { status: 500, statusText: 'Error' });
    expect(choice.models()).toEqual([]);
    expect(choice.chosen()).toBeNull();

    choice.load();
    answerModels(backend);
    expect(choice.chosen()?.label).toBe('Claude Opus 5');
  });

  it('sends the picked model, and the default one when the server no longer knows it', () => {
    start('m-2');
    choice.load();
    answerModels(backend, [aiProvider({ models: [opus, sonnet] })]);
    const http = TestBed.inject(HttpClient);
    const answers: unknown[] = [];
    const failures: unknown[] = [];
    const sent: (string | undefined)[] = [];
    const send = (): void => {
      choice
        .send((modelId) => {
          sent.push(modelId);
          return http.post('/x', { modelId });
        })
        .subscribe({
          next: (answer) => answers.push(answer),
          error: (e: unknown) => failures.push(e),
        });
    };

    send();
    backend
      .expectOne('/x')
      .flush({ status: 409, code: 'ai.model.unknown' }, { status: 409, statusText: 'Conflict' });
    expect(localStorage.getItem(MODEL_CHOICE_KEY)).toBeNull();
    answerModels(backend, [aiProvider({ models: [opus] })]);
    backend.expectOne('/x').flush({ ok: true });
    expect(sent).toEqual(['m-2', undefined]);
    expect(answers).toEqual([{ ok: true }]);

    send();
    backend
      .expectOne('/x')
      .flush({ status: 409, code: 'ai.model.unknown' }, { status: 409, statusText: 'Conflict' });
    backend.expectNone(PROVIDERS);
    expect(sent).toEqual(['m-2', undefined, undefined]);
    expect(failures).toHaveLength(1);
  });
});
