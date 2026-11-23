import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MessageService } from 'primeng/api';
import { aiProvider, answerModels, savedPrompt } from '@testing/ai-fixtures';
import { aStudent, aTag } from '@testing/identity-fixtures';
import {
  bodyText,
  buttonByText,
  hostElement,
  readableText,
  requireElement,
  typeInto,
} from '@testing/dom';
import { testProviders } from '@testing/setup';
import { SourceOption } from './data-access/ai.models';
import { AppliedPlan, LessonPlanAiPanel } from './lesson-plan-ai-panel';

const BOOK: SourceOption = {
  key: 'textbook-t-1',
  label: 'Spotlight 5, с. 12-14',
  source: { type: 'TEXTBOOK', id: 't-1', pages: '12-14' },
};
const VIDEO: SourceOption = {
  key: 'video-1',
  label: 'Видео: Грамматика',
  source: { type: 'VIDEO', title: null, url: 'https://youtu.be/x', transcript: '[0:01] hi' },
};

describe('LessonPlanAiPanel', () => {
  let fixture: ComponentFixture<LessonPlanAiPanel>;
  let backend: HttpTestingController;
  let applied: AppliedPlan[];

  async function render(
    tags = true,
    prompts = [savedPrompt()],
  ): Promise<{ panel: LessonPlanAiPanel; host: HTMLElement }> {
    TestBed.configureTestingModule({ imports: [LessonPlanAiPanel], providers: testProviders() });
    backend = TestBed.inject(HttpTestingController);
    vi.spyOn(TestBed.inject(MessageService), 'add');
    fixture = TestBed.createComponent(LessonPlanAiPanel);
    applied = [];
    fixture.componentInstance.applied.subscribe((plan) => applied.push(plan));
    fixture.componentRef.setInput('sources', [BOOK, VIDEO]);
    fixture.componentRef.setInput('students', ['student-1']);
    fixture.componentRef.setInput('courseName', 'Английский');
    fixture.componentRef.setInput('lesson', {
      topic: 'Present Perfect',
      previousSummary: 'Past Simple',
    });
    await fixture.whenStable();
    backend.expectOne('/api/teacher/ai/prompts').flush(prompts);
    answerModels(backend, [aiProvider()]);
    backend.expectOne('/api/teacher/tags').flush(tags ? [aTag()] : []);
    backend
      .expectOne('/api/teacher/students')
      .flush(tags ? [aStudent({ tags: { 'tag-1': 'v-2' } })] : []);
    await fixture.whenStable();
    return { panel: fixture.componentInstance, host: hostElement(fixture) };
  }

  afterEach(() => {
    backend.verify();
    fixture.destroy();
    vi.restoreAllMocks();
  });

  it('shows what it knows, drafts a plan from the chosen sources and takes it', async () => {
    const { panel, host } = await render();
    expect(readableText(host)).toContain('Тема: Present Perfect');
    expect(readableText(host)).toContain('Итоги предыдущего урока');

    panel.generate();
    backend.expectNone('/api/teacher/ai/lesson-plan');

    panel.prompt.setValue(' Урок на час ');
    // the video is left out
    panel.toggle('video-1', false);
    panel.toggle('video-1', true);
    panel.toggle('video-1', false);
    buttonByText(host, 'Сгенерировать').click();
    panel.generate();
    const request = backend.expectOne('/api/teacher/ai/lesson-plan');
    expect(request.request.body).toEqual({
      prompt: 'Урок на час',
      courseName: 'Английский',
      lesson: { topic: 'Present Perfect', previousSummary: 'Past Simple' },
      sources: [BOOK.source],
      context: [{ name: 'Уровень', value: 'A2' }],
    });
    request.flush({
      title: 'Present Perfect',
      body: '1. **Разминка**',
      textbooks: [{ source: 0, textbookId: 't-1', pages: '12' }],
    });
    await fixture.whenStable();
    expect(host.querySelector('strong')?.textContent).toBe('Разминка');
    expect(readableText(host)).toContain('Страницы учебников ИИ подбирает');

    fixture.componentRef.setInput('hasText', true);
    await fixture.whenStable();
    buttonByText(host, 'Вставить в конец').click();
    await fixture.whenStable();
    expect(applied.map(({ draft, mode }) => [draft.title, mode])).toEqual([
      ['Present Perfect', 'insert'],
    ]);
    expect(readableText(host)).not.toContain('Черновик плана');
  });

  it('takes a saved prompt from «Мои запросы» as the request', async () => {
    const { panel, host } = await render(true, [
      savedPrompt({ id: 'any', title: 'Перевод', text: 'Переведи текст' }),
      savedPrompt(),
    ]);
    buttonByText(host, 'Мои запросы').click();
    await fixture.whenStable();
    expect(bodyText()).toContain('Тест на 10 вопросов');
    const search = requireElement(document.body, '.tb-plan-ai__search input', HTMLInputElement);
    typeInto(search, ' переведи ');
    await fixture.whenStable();
    expect(bodyText()).not.toContain('Тест на 10 вопросов');
    typeInto(search, 'нет такого');
    await fixture.whenStable();
    expect(bodyText()).toContain('Ничего не найдено');
    typeInto(search, '');
    await fixture.whenStable();
    const option = Array.from(
      document.body.querySelectorAll<HTMLElement>('.tb-plan-ai__option'),
    ).find((candidate) => candidate.textContent.includes('Перевод'));
    option?.click();
    await fixture.whenStable();
    expect(panel.prompt.value).toBe('Переведи текст');
  });

  it('saves the request as a prompt of the library, and says when it fails', async () => {
    const { panel, host } = await render(true, []);
    panel.prompt.setValue('Урок по Present Perfect\nс видео');
    buttonByText(host, 'Мои запросы').click();
    await fixture.whenStable();
    buttonByText(document.body, 'Сохранить запрос как промпт').click();
    await fixture.whenStable();
    expect(panel.promptTitle.value).toBe('Урок по Present Perfect');

    panel.promptTitle.setValue(' ');
    panel.savePrompt();
    backend.expectNone('/api/teacher/ai/prompts');
    panel.promptTitle.setValue('Урок с видео');
    buttonByText(document.body, 'Сохранить').click();
    const saved = backend.expectOne({ method: 'POST', url: '/api/teacher/ai/prompts' });
    expect(saved.request.body).toEqual({
      title: 'Урок с видео',
      text: 'Урок по Present Perfect\nс видео',
    });
    saved.flush(savedPrompt({ title: 'Урок с видео' }));
    await fixture.whenStable();
    expect(TestBed.inject(MessageService).add).toHaveBeenCalled();

    buttonByText(host, 'Мои запросы').click();
    await fixture.whenStable();
    expect(bodyText()).toContain('Урок с видео');
    buttonByText(document.body, 'Сохранить запрос как промпт').click();
    await fixture.whenStable();
    buttonByText(document.body, 'Сохранить').click();
    backend
      .expectOne({ method: 'POST', url: '/api/teacher/ai/prompts' })
      .flush(null, { status: 500, statusText: 'Error' });
    await fixture.whenStable();
    expect(readableText(host)).toContain('Не удалось сохранить промпт');
    buttonByText(document.body, 'Отмена').click();
    await fixture.whenStable();
    expect(bodyText()).toContain('Управлять библиотекой');
  });

  it('offers the library when the teacher has no prompts yet', async () => {
    const { host } = await render(true, []);
    buttonByText(host, 'Мои запросы').click();
    await fixture.whenStable();
    expect(bodyText()).toContain('Промптов пока нет');
  });

  it('replaces the plan, discards a draft and reports a failure', async () => {
    const { panel, host } = await render(false);
    fixture.componentRef.setInput('sources', []);
    fixture.componentRef.setInput('lesson', null);
    fixture.componentRef.setInput('courseName', null);
    await fixture.whenStable();
    expect(readableText(host)).toContain('Добавьте учебник');

    panel.prompt.setValue('План');
    panel.generate();
    const request = backend.expectOne('/api/teacher/ai/lesson-plan');
    expect(request.request.body).toEqual({ prompt: 'План', sources: [], context: [] });
    request.flush({ code: 'ai.invalid-answer' }, { status: 422, statusText: 'Unprocessable' });
    await fixture.whenStable();
    expect(readableText(host)).toContain('Не удалось получить план');

    panel.generate();
    backend
      .expectOne('/api/teacher/ai/lesson-plan')
      .flush({ title: 'План', body: 'Текст', textbooks: [] });
    await fixture.whenStable();
    buttonByText(host, 'Отбросить').click();
    await fixture.whenStable();
    expect(readableText(host)).not.toContain('Черновик плана');

    panel.generate();
    backend
      .expectOne('/api/teacher/ai/lesson-plan')
      .flush({ title: 'План', body: 'Текст', textbooks: [] });
    await fixture.whenStable();
    buttonByText(host, 'Заменить план').click();
    expect(applied.map((plan) => plan.mode)).toEqual(['replace']);
  });
});
