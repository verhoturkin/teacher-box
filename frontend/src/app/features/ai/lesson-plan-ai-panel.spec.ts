import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MessageService } from 'primeng/api';
import { aiProvider, answerModels } from '@testing/ai-fixtures';
import { aStudent, aTag } from '@testing/identity-fixtures';
import { buttonByText, hostElement, readableText } from '@testing/dom';
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

  async function render(tags = true): Promise<{ panel: LessonPlanAiPanel; host: HTMLElement }> {
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
      previousNextPlan: null,
    });
    await fixture.whenStable();
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
      lesson: { topic: 'Present Perfect', previousSummary: 'Past Simple', previousNextPlan: null },
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
