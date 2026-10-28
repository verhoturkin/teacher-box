import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MessageService } from 'primeng/api';
import { savedPrompt } from '@testing/ai-fixtures';
import {
  bodyText,
  buttonByText,
  hostElement,
  readableText,
  requireElement,
  typeInto,
} from '@testing/dom';
import { testProviders } from '@testing/setup';
import { AppliedDraft, AppliedQuestions, HomeworkAiPanel } from './homework-ai-panel';

describe('HomeworkAiPanel', () => {
  let fixture: ComponentFixture<HomeworkAiPanel>;
  let backend: HttpTestingController;
  let applied: AppliedDraft[];

  async function render(prompts = [savedPrompt()]) {
    TestBed.configureTestingModule({ imports: [HomeworkAiPanel], providers: testProviders() });
    backend = TestBed.inject(HttpTestingController);
    vi.spyOn(TestBed.inject(MessageService), 'add');
    fixture = TestBed.createComponent(HomeworkAiPanel);
    fixture.componentRef.setInput('title', '  Дроби ');
    applied = [];
    fixture.componentInstance.applied.subscribe((draft) => applied.push(draft));
    await fixture.whenStable();
    backend.expectOne('/api/teacher/ai/prompts').flush(prompts);
    await fixture.whenStable();
    return { panel: fixture.componentInstance, host: hostElement(fixture) };
  }

  /** Opens a popover of the panel by its button; popovers are appended to the body. */
  async function open(host: HTMLElement, button: string) {
    buttonByText(host, button).click();
    await fixture.whenStable();
  }

  function switchToQuestions(host: HTMLElement): void {
    const toggle = Array.from(host.querySelectorAll<HTMLElement>('p-selectbutton [role]')).find(
      (candidate) => candidate.textContent.includes('Вопросы'),
    );
    if (toggle === undefined) {
      throw new Error(host.querySelector('p-selectbutton')?.outerHTML ?? 'no select button');
    }
    toggle.click();
  }

  function option(text: string): HTMLElement {
    const found = Array.from(
      document.body.querySelectorAll<HTMLElement>('.tb-ai-panel__option'),
    ).find((candidate) => candidate.textContent.includes(text));
    if (found === undefined) {
      throw new Error(`Option "${text}" not found`);
    }
    return found;
  }

  afterEach(() => {
    backend.verify();
    fixture.destroy();
    vi.restoreAllMocks();
  });

  it('takes a prompt from the menu, drafts homework and inserts it or replaces the text', async () => {
    const { panel, host } = await render([
      savedPrompt({ id: 'any', title: 'Перевод', text: 'Переведи текст' }),
      savedPrompt(),
    ]);

    expect(readableText(host)).not.toContain('Перевод');
    await open(host, 'Промты');
    expect(bodyText()).toContain('Тест на 10 вопросов');
    const search = requireElement(document.body, '.tb-ai-panel__search input', HTMLInputElement);
    typeInto(search, ' переведи ');
    await fixture.whenStable();
    expect(bodyText()).not.toContain('Тест на 10 вопросов');
    typeInto(search, 'нет такого');
    await fixture.whenStable();
    expect(bodyText()).toContain('Ничего не найдено');
    typeInto(search, '');
    await fixture.whenStable();
    option('Перевод').click();
    await fixture.whenStable();
    expect(panel.prompt.value).toBe('Переведи текст');

    panel.prompt.setValue('');
    panel.generate();
    backend.expectNone('/api/teacher/ai/homework-draft');

    panel.prompt.setValue(' 5 задач на дроби ');
    buttonByText(host, 'Сгенерировать').click();
    const request = backend.expectOne('/api/teacher/ai/homework-draft');
    expect(request.request.body).toEqual({
      prompt: '5 задач на дроби',
      title: 'Дроби',
      sources: [],
    });
    request.flush({ title: 'Сложение дробей', description: '1. Сложите **1/2**' });
    await fixture.whenStable();
    expect(host.querySelector('.tb-ai-panel__draft strong')?.textContent).toBe('1/2');
    expect(readableText(host)).not.toContain('Вставить в конец');
    expect(readableText(host)).toContain('Ещё раз');

    const request$ = host.querySelector('.tb-ai-panel__request');
    expect(request$?.classList).toContain('tb-ai-panel__request--folded');
    host.querySelector('textarea')?.dispatchEvent(new Event('focus'));
    await fixture.whenStable();
    expect(request$?.classList).not.toContain('tb-ai-panel__request--folded');

    fixture.componentRef.setInput('hasText', true);
    await fixture.whenStable();
    buttonByText(host, 'Вставить в конец').click();
    await fixture.whenStable();
    expect(applied.map(({ draft, mode }) => [draft.title, mode])).toEqual([
      ['Сложение дробей', 'insert'],
    ]);
    expect(host.querySelector('.tb-ai-panel__draft')).toBeNull();
    expect(readableText(host)).toContain('Сгенерировать');
  });

  it('says when the draft fails and replaces the text with a new one', async () => {
    const { panel, host } = await render();

    panel.prompt.setValue('Тест');
    panel.generate();
    panel.generate();
    backend
      .expectOne('/api/teacher/ai/homework-draft')
      .flush(
        { status: 422, code: 'ai.invalid-answer' },
        { status: 422, statusText: 'Unprocessable' },
      );
    await fixture.whenStable();
    expect(readableText(host)).toContain('Модель вернула ответ в неверном формате');

    panel.generate();
    backend
      .expectOne('/api/teacher/ai/homework-draft')
      .flush({ title: 'Тест', description: 'Ответьте' });
    await fixture.whenStable();
    buttonByText(host, 'Заменить').click();
    expect(applied.map(({ draft, mode }) => [draft.title, mode])).toEqual([['Тест', 'replace']]);
  });

  it('saves the request to the library under a title from the menu', async () => {
    const { panel, host } = await render([]);

    await open(host, 'Промты');
    expect(bodyText()).toContain('Промтов пока нет');
    expect(bodyText()).toContain('Управлять библиотекой');
    panel.prompt.setValue('Тест на 5 вопросов\nс выбором ответа');
    buttonByText(document.body, 'Сохранить запрос как промт').click();
    await fixture.whenStable();
    expect(panel.promptTitle.value).toBe('Тест на 5 вопросов');

    panel.promptTitle.setValue(' ');
    panel.savePrompt();
    backend.expectNone('/api/teacher/ai/prompts');
    panel.promptTitle.setValue('Тест');
    buttonByText(document.body, 'Сохранить').click();
    const saved = backend.expectOne({ method: 'POST', url: '/api/teacher/ai/prompts' });
    expect(saved.request.body).toEqual({
      title: 'Тест',
      text: 'Тест на 5 вопросов\nс выбором ответа',
    });
    saved.flush(savedPrompt({ title: 'Тест' }));
    await fixture.whenStable();
    expect(TestBed.inject(MessageService).add).toHaveBeenCalled();

    await open(host, 'Промты');
    expect(option('Тест')).toBeTruthy();
    buttonByText(document.body, 'Сохранить запрос как промт').click();
    await fixture.whenStable();
    buttonByText(document.body, 'Сохранить').click();
    backend
      .expectOne({ method: 'POST', url: '/api/teacher/ai/prompts' })
      .flush(null, { status: 500, statusText: 'Error' });
    await fixture.whenStable();
    expect(readableText(host)).toContain('Не удалось сохранить промт');
    buttonByText(document.body, 'Отмена').click();
    await fixture.whenStable();
    expect(bodyText()).toContain('Управлять библиотекой');
  });

  it('sends the ticked sources and counts them on the button', async () => {
    const { panel, host } = await render([]);
    expect(readableText(host)).not.toContain('Опереться на');
    fixture.componentRef.setInput('sources', [
      {
        key: 'tb',
        label: 'Spotlight 5, с. 2-3',
        source: { type: 'TEXTBOOK', id: 'tb-1', pages: '2-3' },
      },
      { key: 'f', label: 'Задачи.pdf', source: { type: 'FILE', id: 'f-1', assignmentId: 'a-1' } },
    ]);
    await fixture.whenStable();

    await open(host, 'Опереться на');
    document.body.querySelector<HTMLInputElement>('#ai-source-f')?.click();
    document.body.querySelector<HTMLInputElement>('#ai-source-tb')?.click();
    document.body.querySelector<HTMLInputElement>('#ai-source-tb')?.click();
    await fixture.whenStable();
    expect(readableText(host)).toContain('Опереться на · 1');
    panel.prompt.setValue('По файлу');
    panel.generate();

    expect(backend.expectOne('/api/teacher/ai/homework-draft').request.body).toMatchObject({
      sources: [{ type: 'FILE', id: 'f-1', assignmentId: 'a-1' }],
    });
  });

  it('sends a picked file with the request and forgets one taken off', async () => {
    const { panel, host } = await render([]);
    const scan = new File(['png'], 'Скан.png', { type: 'image/png' });
    fixture.componentRef.setInput('sources', [{ key: 'new', label: 'Скан.png', source: scan }]);
    await fixture.whenStable();

    await open(host, 'Опереться на');
    document.body.querySelector<HTMLInputElement>('#ai-source-new')?.click();
    await fixture.whenStable();
    expect(readableText(host)).toContain('Опереться на · 1');
    panel.prompt.setValue('По скану');
    panel.generate();
    const body: unknown = backend.expectOne('/api/teacher/ai/homework-draft').request.body;
    expect(body instanceof FormData && body.getAll('files')).toEqual([scan]);

    fixture.componentRef.setInput('sources', []);
    await fixture.whenStable();
    expect(readableText(host)).not.toContain('Опереться на');
  });

  it('drafts quiz questions, shows the key and appends or replaces them', async () => {
    const { panel, host } = await render([]);
    const taken: AppliedQuestions[] = [];
    panel.questionsApplied.subscribe((questions) => taken.push(questions));
    const question = (id: string, type: string, extra: object) => ({
      id,
      type,
      text: `Вопрос ${id}`,
      points: 2,
      explanation: null,
      options: [],
      correct: [],
      accepted: [],
      value: null,
      tolerance: null,
      pairs: [],
      ...extra,
    });
    const drafted = [
      question('a', 'SINGLE_CHOICE', {
        options: [
          { id: 'o1', text: 'Один' },
          { id: 'o2', text: 'Два' },
        ],
        correct: ['o2'],
      }),
      question('b', 'ORDERING', {
        options: [
          { id: 'o1', text: 'Раз' },
          { id: 'o2', text: 'Два' },
        ],
      }),
      question('c', 'MATCHING', { pairs: [{ id: 'p', left: 'Кот', right: 'Cat' }] }),
      question('d', 'NUMBER', { value: 3 }),
      question('e', 'SHORT_TEXT', { accepted: ['да', 'ага'] }),
    ];

    switchToQuestions(host);
    await fixture.whenStable();
    panel.prompt.setValue('Пять вопросов');
    panel.generate();
    backend.expectOne('/api/teacher/ai/quiz-draft').flush({ questions: drafted });
    await fixture.whenStable();
    const text = readableText(host);
    for (const part of ['Один ответ · 2 б.', 'Два', 'Раз → Два', 'Кот — Cat', '3', 'да; ага']) {
      expect(text).toContain(part);
    }
    expect(text).not.toContain('Заменить все');
    expect(text).toContain('Ещё раз');

    fixture.componentRef.setInput('questionCount', 2);
    await fixture.whenStable();
    buttonByText(host, 'Добавить в конец').click();
    await fixture.whenStable();
    expect(taken.map(({ mode, questions }) => [mode, questions.length])).toEqual([['append', 5]]);

    panel.generate();
    backend.expectOne('/api/teacher/ai/quiz-draft').flush({ questions: drafted });
    await fixture.whenStable();
    buttonByText(host, 'Заменить все').click();
    await fixture.whenStable();
    expect(taken[1]?.mode).toBe('replace');
  });

  it('keeps the quiz when it is locked and says when no question fits', async () => {
    const { panel, host } = await render([]);
    fixture.componentRef.setInput('quizLocked', true);
    switchToQuestions(host);
    await fixture.whenStable();
    panel.prompt.setValue('Вопросы');
    panel.generate();
    backend.expectOne('/api/teacher/ai/quiz-draft').flush({ questions: [] });
    await fixture.whenStable();
    expect(readableText(host)).toContain('не предложил');
    expect(readableText(host)).toContain('Ученики уже начали тест');

    panel.generate();
    backend.expectOne('/api/teacher/ai/quiz-draft').flush(null, { status: 500, statusText: 'E' });
    await fixture.whenStable();
    expect(readableText(host)).toContain('Не удалось получить черновик');
  });

  it('works without the library', async () => {
    TestBed.configureTestingModule({ imports: [HomeworkAiPanel], providers: testProviders() });
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(HomeworkAiPanel);
    await fixture.whenStable();
    backend.expectOne('/api/teacher/ai/prompts').flush(null, { status: 500, statusText: 'Error' });
    await fixture.whenStable();

    expect(readableText(hostElement(fixture))).toContain('Сгенерировать');
  });
});
