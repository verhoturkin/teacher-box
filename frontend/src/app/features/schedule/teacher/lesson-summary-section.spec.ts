import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Snackbar } from '@core/snackbar/snackbar';
import { bodyText, buttonByText, requireElement, typeInto } from '@testing/dom';
import { AiProvider } from '@features/ai/parts';
import { aiModel, aiProvider, answerModels } from '@testing/ai-fixtures';
import { assignmentSummary } from '@testing/homework-fixtures';
import { groupLesson, scheduledLesson } from '@testing/schedule-fixtures';
import { aLessonPlan } from '@testing/textbooks-fixtures';
import { testProviders } from '@testing/setup';
import { ScheduledLesson } from '../data-access/schedule.models';
import { LessonSummarySection } from './lesson-summary-section';

const STATUS = '/api/teacher/ai/status';
const DRAFT = '/api/teacher/ai/lesson-summary';
const ASSIGNMENTS = '/api/teacher/homework/assignments';
const SUMMARY = '/api/teacher/schedule/lessons/l-1/summary';
const SHARE = '/api/teacher/schedule/lessons/l-1/summary/share';
const PLAN = '/api/teacher/textbooks/plans/p-1';

describe('LessonSummarySection', () => {
  let fixture: ComponentFixture<LessonSummarySection>;
  let ai: boolean;
  let backend: HttpTestingController;
  let saved: ScheduledLesson[];
  let success: ReturnType<typeof vi.spyOn>;
  let failure: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [LessonSummarySection], providers: testProviders() });
    backend = TestBed.inject(HttpTestingController);
    success = vi.spyOn(TestBed.inject(Snackbar), 'success');
    failure = vi.spyOn(TestBed.inject(Snackbar), 'error');
    ai = false;
  });

  afterEach(() => {
    backend.verify();
    fixture.destroy();
  });

  async function open(lesson: ScheduledLesson): Promise<void> {
    fixture = TestBed.createComponent(LessonSummarySection);
    saved = [];
    fixture.componentInstance.saved.subscribe((result) => saved.push(result));
    fixture.componentRef.setInput('lesson', lesson);
    await fixture.whenStable();
    backend.expectOne(STATUS).flush({ enabled: ai });
    await fixture.whenStable();
  }

  function field(selector: string): HTMLTextAreaElement {
    return requireElement(document.body, selector, HTMLTextAreaElement);
  }

  async function type(selector: string, value: string): Promise<void> {
    typeInto(field(selector), value);
    await fixture.whenStable();
  }

  async function press(label: string): Promise<void> {
    buttonByText(document.body, label).click();
    await fixture.whenStable();
  }

  it('prefills «Что прошли» with the topic while no summary is saved', async () => {
    await open(scheduledLesson({ topic: 'Past Simple' }));

    expect(field('#lesson-summary-text').value).toBe('Past Simple');
    expect(bodyText()).toContain('Видно ученикам этого занятия');
  });

  it('shows the saved summary and plan rather than the topic', async () => {
    await open(scheduledLesson({ topic: 'Тема', summary: 'Было', nextPlan: 'План' }));

    expect(field('#lesson-summary-text').value).toBe('Было');
    expect(field('#lesson-summary-next').value).toBe('План');
    expect(buttonByText(document.body, 'Сохранить').disabled).toBe(true);
  });

  it('saves the changed fields at «Сохранить» and shares nothing', async () => {
    await open(scheduledLesson());
    await type('#lesson-summary-text', ' Past Simple ');
    await type('#lesson-summary-next', 'Past Continuous');
    backend.expectNone(SUMMARY);

    await press('Сохранить');
    const request = backend.expectOne(SUMMARY);
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({ summary: 'Past Simple', nextPlan: 'Past Continuous' });
    const updated = scheduledLesson({ summary: 'Past Simple', nextPlan: 'Past Continuous' });
    request.flush(updated);
    await fixture.whenStable();

    backend.expectNone(SHARE);
    expect(saved).toEqual([updated]);
    expect(success).toHaveBeenCalledWith('Итоги сохранены');
  });

  it('clears an emptied field', async () => {
    await open(scheduledLesson({ summary: 'Было', nextPlan: 'План' }));
    await type('#lesson-summary-text', '  ');
    await type('#lesson-summary-next', '');

    await press('Сохранить');

    const request = backend.expectOne(SUMMARY);
    expect(request.request.body).toEqual({ summary: null, nextPlan: null });
    request.flush(scheduledLesson());
  });

  it('sends the prefilled topic: the write first, then the share', async () => {
    await open(scheduledLesson({ topic: 'Past Simple' }));

    await press('Отправить ученику');
    backend.expectNone(SHARE);
    const updated = scheduledLesson({ topic: 'Past Simple', summary: 'Past Simple' });
    const request = backend.expectOne(SUMMARY);
    expect(request.request.body).toEqual({ summary: 'Past Simple', nextPlan: null });
    request.flush(updated);
    await fixture.whenStable();
    backend.expectOne(SHARE).flush(null);
    await fixture.whenStable();

    expect(saved).toEqual([updated]);
    expect(success).toHaveBeenCalledWith('Итоги отправлены');
  });

  it('sends a saved summary without writing it again', async () => {
    await open(scheduledLesson({ summary: 'Готово' }));

    await press('Отправить ученику');

    backend.expectOne(SHARE).flush(null);
    await fixture.whenStable();
    backend.expectNone(SUMMARY);
    expect(saved).toHaveLength(1);
  });

  it('does not send an empty summary and names the students of a group', async () => {
    await open(groupLesson());

    const send = buttonByText(document.body, 'Отправить ученикам');
    expect(send.disabled).toBe(true);
    send.click();
    await fixture.whenStable();
    backend.expectNone('/api/teacher/schedule/lessons/gl-1/summary');
  });

  it('tells a failed save and keeps the text', async () => {
    await open(scheduledLesson());
    await type('#lesson-summary-text', 'Текст');

    await press('Сохранить');
    backend.expectOne(SUMMARY).flush({}, { status: 500, statusText: 'Server Error' });
    await fixture.whenStable();

    expect(failure).toHaveBeenCalledWith('Не удалось сохранить итоги');
    expect(field('#lesson-summary-text').value).toBe('Текст');
    expect(saved).toEqual([]);
  });

  it('has no field for private notes', async () => {
    await open(
      scheduledLesson({
        notes: [{ studentId: 's-1', note: 'Старое', updatedAt: '2026-10-01T00:00:00Z' }],
      }),
    );

    expect(bodyText()).not.toContain('Заметка для себя');
    expect(bodyText()).not.toContain('Старое');
  });

  describe('with a plan on the lesson', () => {
    it('reads «Прошли по плану» without the field and sends it without a write', async () => {
      await open(scheduledLesson({ topic: 'Past Simple', planId: 'p-1' }));

      expect(bodyText()).toContain('Прошли по плану');
      expect(document.body.querySelector('#lesson-summary-text')).toBeNull();
      await press('Отправить ученику');
      backend.expectNone(SUMMARY);
      backend.expectOne(SHARE).flush(null);
      await fixture.whenStable();
      expect(success).toHaveBeenCalledWith('Итоги отправлены');
    });

    it('opens an empty field for the deviations at «Не всё по плану»', async () => {
      await open(scheduledLesson({ topic: 'Past Simple', planId: 'p-1' }));

      await press('Не всё по плану');
      expect(field('#lesson-summary-text').value).toBe('');
      expect(bodyText()).toContain('Что прошло не по плану');
      await type('#lesson-summary-text', 'Не успели упр. 5');
      await press('Сохранить');
      expect(backend.expectOne(SUMMARY).request.body).toEqual({
        summary: 'Не успели упр. 5',
        nextPlan: null,
      });
    });

    it('shows the saved deviations in the open field', async () => {
      await open(scheduledLesson({ planId: 'p-1', summary: 'Добавили диктант' }));

      expect(field('#lesson-summary-text').value).toBe('Добавили диктант');
      expect(bodyText()).not.toContain('Не всё по плану');
    });
  });

  describe('AI draft', () => {
    const draftButton = (): HTMLButtonElement => buttonByText(document.body, 'Черновик');

    /** Opens the draft part; its model picker reads the connections. */
    async function openDraft(providers?: readonly AiProvider[]): Promise<void> {
      draftButton().click();
      await fixture.whenStable();
      answerModels(backend, providers);
      await fixture.whenStable();
    }

    it('is not offered while the AI feature is off', async () => {
      await open(scheduledLesson());

      expect(bodyText()).not.toContain('Черновик');
    });

    describe('with the AI feature on', () => {
      beforeEach(() => {
        ai = true;
      });

      it('drafts from the topic, the words and the linked assignments, in place of the topic', async () => {
        await open(scheduledLesson({ topic: 'Past Simple', assignmentIds: ['a-2', 'a-1', 'a-9'] }));
        await openDraft();
        await type('#lesson-summary-words', 'ошибки в глаголах');

        await press('Составить');
        backend
          .expectOne(ASSIGNMENTS)
          .flush([
            assignmentSummary({ id: 'a-1', title: 'Глаголы' }),
            assignmentSummary({ id: 'a-2', title: 'Слова' }),
            assignmentSummary({ id: 'a-3', title: 'Чужое' }),
          ]);
        await fixture.whenStable();
        const request = backend.expectOne(DRAFT);
        expect(request.request.body).toEqual({
          topic: 'Past Simple',
          words: 'ошибки в глаголах',
          assignmentTitles: ['Слова', 'Глаголы'],
        });
        request.flush({ summary: 'Разобрали **Past Simple**' });
        await fixture.whenStable();

        expect(field('#lesson-summary-text').value).toBe('Разобрали **Past Simple**');
        expect(buttonByText(document.body, 'Ещё раз')).toBeTruthy();
      });

      it('goes after the text already written and reads the assignments once', async () => {
        await open(scheduledLesson({ topic: 'Тема', summary: 'Было', assignmentIds: ['a-1'] }));
        await openDraft();

        for (const answer of ['Первый', 'Второй']) {
          await press(answer === 'Первый' ? 'Составить' : 'Ещё раз');
          if (answer === 'Первый') {
            backend.expectOne(ASSIGNMENTS).flush([assignmentSummary()]);
            await fixture.whenStable();
          }
          backend.expectOne(DRAFT).flush({ summary: answer });
          await fixture.whenStable();
        }

        expect(field('#lesson-summary-text').value).toBe('Было\n\nПервый\n\nВторой');
      });

      it('asks for a topic or a few words first', async () => {
        await open(scheduledLesson({ topic: null }));
        await openDraft();

        expect(bodyText()).toContain('Укажите тему урока');
        expect(buttonByText(document.body, 'Составить').disabled).toBe(true);
        await type('#lesson-summary-words', 'повторили времена');
        expect(buttonByText(document.body, 'Составить').disabled).toBe(false);
      });

      it('tells a failed draft next to the field and leaves the text alone', async () => {
        await open(scheduledLesson({ topic: 'Тема', assignmentIds: ['a-1'] }));
        await openDraft();

        await press('Составить');
        backend.expectOne(ASSIGNMENTS).error(new ProgressEvent('offline'));
        await fixture.whenStable();
        backend.expectOne(DRAFT).flush({}, { status: 502, statusText: 'Bad Gateway' });
        await fixture.whenStable();

        expect(bodyText()).toContain('Не удалось составить черновик');
        expect(field('#lesson-summary-text').value).toBe('Тема');
      });

      it('with a plan drafts the deviations from the words and the plan title', async () => {
        await open(scheduledLesson({ topic: 'Past Simple', planId: 'p-1' }));
        await openDraft();
        expect(bodyText()).toContain('Напишите пару слов о том, что пошло не по плану');
        await type('#lesson-summary-words', 'не успели упр. 5');

        await press('Составить');
        backend.expectOne(PLAN).flush(aLessonPlan({ id: 'p-1', title: 'Времена' }));
        await fixture.whenStable();
        const request = backend.expectOne(DRAFT);
        expect(request.request.body).toEqual({
          topic: 'Past Simple',
          words: 'не успели упр. 5',
          planTitle: 'Времена',
          assignmentTitles: [],
        });
        request.flush({ summary: 'Не успели упражнение 5.' });
        await fixture.whenStable();

        expect(field('#lesson-summary-text').value).toBe('Не успели упражнение 5.');
      });

      it('with a plan an empty draft keeps «Прошли по плану», a failed plan read a stand-in title', async () => {
        await open(scheduledLesson({ planId: 'p-1' }));
        await openDraft();
        await type('#lesson-summary-words', 'всё успели');

        await press('Составить');
        backend.expectOne(PLAN).flush({}, { status: 404, statusText: 'Not Found' });
        await fixture.whenStable();
        const request = backend.expectOne(DRAFT);
        expect(request.request.body).toHaveProperty('planTitle', 'План урока');
        request.flush({ summary: ' ' });
        await fixture.whenStable();

        expect(bodyText()).toContain('По вашим словам всё прошло по плану');
        expect(document.body.querySelector('#lesson-summary-text')).toBeNull();
      });

      it('writes with the model picked beside «Составить», and with the default one once it is gone', async () => {
        localStorage.setItem('tb.ai.model', 'm-2');
        await open(scheduledLesson({ topic: 'Тема' }));
        await openDraft([
          aiProvider({
            models: [aiModel(), aiModel({ id: 'm-2', label: 'Claude Sonnet 5', default: false })],
          }),
        ]);
        expect(
          requireElement(document.body, '.tb-model-pick', HTMLButtonElement).textContent,
        ).toContain('Claude Sonnet 5');

        await press('Составить');
        await fixture.whenStable();
        backend
          .expectOne(DRAFT)
          .flush(
            { status: 409, code: 'ai.model.unknown', defaultModelId: 'm-1' },
            { status: 409, statusText: 'Conflict' },
          );
        await fixture.whenStable();
        expect(localStorage.getItem('tb.ai.model')).toBeNull();
        answerModels(backend, [aiProvider()]);
        const retry = backend.expectOne(DRAFT);
        expect(retry.request.body).not.toHaveProperty('modelId', 'm-2');
        retry.flush({ summary: 'Готово' });
        await fixture.whenStable();
        expect(field('#lesson-summary-text').value).toBe('Готово');
      });
    });
  });
});
