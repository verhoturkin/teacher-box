import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MessageService } from 'primeng/api';
import { savedPrompt } from '@testing/ai-fixtures';
import { buttonByText, hostElement, readableText } from '@testing/dom';
import { testProviders } from '@testing/setup';
import { AppliedDraft, HomeworkAiPanel } from './homework-ai-panel';

describe('HomeworkAiPanel', () => {
  let fixture: ComponentFixture<HomeworkAiPanel>;
  let backend: HttpTestingController;
  let applied: AppliedDraft[];

  async function render(kind: 'WRITTEN' | 'INTERACTIVE', prompts = [savedPrompt()]) {
    TestBed.configureTestingModule({ imports: [HomeworkAiPanel], providers: testProviders() });
    backend = TestBed.inject(HttpTestingController);
    vi.spyOn(TestBed.inject(MessageService), 'add');
    fixture = TestBed.createComponent(HomeworkAiPanel);
    fixture.componentRef.setInput('kind', kind);
    fixture.componentRef.setInput('title', '  Дроби ');
    applied = [];
    fixture.componentInstance.applied.subscribe((draft) => applied.push(draft));
    await fixture.whenStable();
    backend.expectOne('/api/teacher/ai/prompts').flush(prompts);
    await fixture.whenStable();
    return { panel: fixture.componentInstance, host: hostElement(fixture) };
  }

  afterEach(() => {
    backend.verify();
    fixture.destroy();
    vi.restoreAllMocks();
  });

  it('drafts written homework and inserts it or replaces the text', async () => {
    const { panel, host } = await render('WRITTEN', [
      savedPrompt({ id: 'any', title: 'Перевод', kind: null, text: 'Переведи текст' }),
      savedPrompt(),
    ]);

    expect(readableText(host)).toContain('Перевод');
    expect(readableText(host)).not.toContain('Тест на 10 вопросов');
    buttonByText(host, 'Перевод').click();
    expect(panel.prompt.value).toBe('Переведи текст');

    panel.prompt.setValue('');
    panel.generate();
    backend.expectNone('/api/teacher/ai/homework-draft');

    panel.prompt.setValue(' 5 задач на дроби ');
    buttonByText(host, 'Сгенерировать').click();
    const request = backend.expectOne('/api/teacher/ai/homework-draft');
    expect(request.request.body).toEqual({
      kind: 'WRITTEN',
      prompt: '5 задач на дроби',
      title: 'Дроби',
      look: null,
      sources: [],
    });
    request.flush({ title: 'Сложение дробей', description: '1. Сложите **1/2**', html: null });
    await fixture.whenStable();
    expect(host.querySelector('.tb-ai-panel__draft strong')?.textContent).toBe('1/2');
    expect(readableText(host)).not.toContain('Вставить в конец');

    fixture.componentRef.setInput('hasText', true);
    await fixture.whenStable();
    buttonByText(host, 'Вставить в конец').click();
    await fixture.whenStable();
    expect(applied.map(({ draft, mode }) => [draft.title, mode])).toEqual([
      ['Сложение дробей', 'insert'],
    ]);
    expect(host.querySelector('.tb-ai-panel__draft')).toBeNull();
  });

  it('asks for a page in the portal look and says when it fails', async () => {
    document.documentElement.style.setProperty('--p-md-primary', '#336699');
    document.documentElement.style.setProperty('--p-md-surface', 'rgb(255, 255, 255)');
    document.documentElement.style.setProperty('--p-md-on-surface', '#111');
    const { panel, host } = await render('INTERACTIVE');

    panel.prompt.setValue('Тест');
    panel.generate();
    panel.generate();
    const request = backend.expectOne('/api/teacher/ai/homework-draft');
    expect(request.request.body).toMatchObject({
      kind: 'INTERACTIVE',
      look: { primary: '#336699', surface: '#ffffff', text: '#111111' },
    });
    request.flush(
      { status: 422, code: 'ai.invalid-answer' },
      { status: 422, statusText: 'Unprocessable' },
    );
    await fixture.whenStable();
    expect(readableText(host)).toContain('Модель вернула ответ в неверном формате');

    panel.generate();
    backend
      .expectOne('/api/teacher/ai/homework-draft')
      .flush({ title: 'Тест', description: 'Ответьте', html: '<p>?</p>' });
    await fixture.whenStable();
    expect(readableText(host)).toContain('Страница готова');
    buttonByText(host, 'Заменить').click();
    expect(applied[0]?.mode).toBe('replace');
    expect(applied[0]?.draft.html).toBe('<p>?</p>');
    for (const name of ['--p-md-primary', '--p-md-surface', '--p-md-on-surface']) {
      document.documentElement.style.removeProperty(name);
    }
  });

  it('saves a prompt to the library under a title', async () => {
    const { panel, host } = await render('INTERACTIVE', []);

    expect(readableText(host)).not.toContain('Мои промты');
    panel.prompt.setValue('Тест на 5 вопросов\nс выбором ответа');
    await fixture.whenStable();
    buttonByText(host, 'Сохранить промт').click();
    await fixture.whenStable();
    expect(panel.promptTitle.value).toBe('Тест на 5 вопросов');

    panel.promptTitle.setValue(' ');
    panel.savePrompt();
    backend.expectNone('/api/teacher/ai/prompts');
    panel.promptTitle.setValue('Тест');
    buttonByText(host, 'Сохранить').click();
    const saved = backend.expectOne({ method: 'POST', url: '/api/teacher/ai/prompts' });
    expect(saved.request.body).toEqual({
      title: 'Тест',
      text: 'Тест на 5 вопросов\nс выбором ответа',
      kind: 'INTERACTIVE',
    });
    saved.flush(savedPrompt({ title: 'Тест' }));
    await fixture.whenStable();
    expect(readableText(host)).toContain('Мои промты');
    expect(TestBed.inject(MessageService).add).toHaveBeenCalled();

    buttonByText(host, 'Сохранить промт').click();
    await fixture.whenStable();
    buttonByText(host, 'Сохранить').click();
    backend
      .expectOne({ method: 'POST', url: '/api/teacher/ai/prompts' })
      .flush(null, { status: 500, statusText: 'Error' });
    await fixture.whenStable();
    expect(readableText(host)).toContain('Не удалось сохранить промт');
    buttonByText(host, 'Отмена').click();
  });

  it('sends the ticked sources', async () => {
    const { panel, host } = await render('WRITTEN', []);
    fixture.componentRef.setInput('sources', [
      {
        key: 'tb',
        label: 'Spotlight 5, с. 2-3',
        source: { type: 'TEXTBOOK', id: 'tb-1', pages: '2-3' },
      },
      { key: 'f', label: 'Задачи.pdf', source: { type: 'FILE', id: 'f-1', assignmentId: 'a-1' } },
    ]);
    await fixture.whenStable();
    expect(readableText(host)).toContain('Опереться на');

    host.querySelector<HTMLInputElement>('#ai-source-f')?.click();
    host.querySelector<HTMLInputElement>('#ai-source-tb')?.click();
    host.querySelector<HTMLInputElement>('#ai-source-tb')?.click();
    await fixture.whenStable();
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
