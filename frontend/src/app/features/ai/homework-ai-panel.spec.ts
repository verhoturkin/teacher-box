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
import { AppliedDraft, HomeworkAiPanel } from './homework-ai-panel';

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
    const search = requireElement(document.body, '.tb-ai-panel__search', HTMLInputElement);
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
