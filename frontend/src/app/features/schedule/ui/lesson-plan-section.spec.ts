import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { bodyText, buttonByText, hostElement, menuItemByText } from '@testing/dom';
import { aiStatus } from '@testing/ai-fixtures';
import { ConfirmHost, testProviders } from '@testing/setup';
import { groupLesson, scheduledLesson } from '@testing/schedule-fixtures';
import { aCourse, aLessonPlan, aPlanSummary } from '@testing/textbooks-fixtures';
import { ScheduledLesson } from '../data-access/schedule.models';
import { LessonPlanSection } from './lesson-plan-section';

describe('LessonPlanSection', () => {
  let fixture: ComponentFixture<LessonPlanSection>;
  let backend: HttpTestingController;
  let navigate: ReturnType<typeof vi.spyOn>;
  let messages: ReturnType<typeof vi.spyOn>;
  let changed: ScheduledLesson[];

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: testProviders() });
    backend = TestBed.inject(HttpTestingController);
    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    messages = vi.spyOn(TestBed.inject(MessageService), 'add');
    TestBed.createComponent(ConfirmHost).detectChanges();
    fixture = TestBed.createComponent(LessonPlanSection);
    changed = [];
    fixture.componentInstance.changed.subscribe((lesson) => changed.push(lesson));
  });

  afterEach(() => {
    backend.match('/api/teacher/ai/status').forEach((request) => {
      request.flush(aiStatus({ enabled: false }));
    });
    backend.verify();
    vi.restoreAllMocks();
  });

  async function show(lesson: ScheduledLesson): Promise<HTMLElement> {
    fixture.componentRef.setInput('lesson', lesson);
    await fixture.whenStable();
    return hostElement(fixture);
  }

  async function settle(): Promise<void> {
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
  }

  /** Chooses a bank item in the picker (its PrimeNG select is not driven here). */
  function choose(id: string): void {
    fixture.componentInstance.chosen.set(id);
    fixture.detectChanges();
  }

  it('offers to write a plan for the student’s lesson, or the group’s, in the editor', async () => {
    const root = await show(scheduledLesson({ id: 'l-1', studentId: 's-1' }));
    expect(root.textContent).toContain('План урока');
    expect(root.textContent).toContain('Плана пока нет');
    buttonByText(root, 'Составить').click();
    expect(navigate).toHaveBeenCalledWith(['/teacher/materials/plans/new'], {
      queryParams: { lessonId: 'l-1', studentId: 's-1' },
    });

    await show(groupLesson({ id: 'l-2', groupId: 'g-1' }));
    buttonByText(root, 'Составить').click();
    expect(navigate).toHaveBeenLastCalledWith(['/teacher/materials/plans/new'], {
      queryParams: { lessonId: 'l-2', groupId: 'g-1' },
    });
  });

  it('opens the editor with the assistant when AI is on', async () => {
    const root = await show(scheduledLesson({ id: 'l-1', studentId: 's-1' }));
    expect(root.textContent).not.toContain('С ИИ');
    backend.expectOne('/api/teacher/ai/status').flush(aiStatus({ enabled: true }));
    await fixture.whenStable();
    buttonByText(root, 'С ИИ').click();
    expect(navigate).toHaveBeenCalledWith(['/teacher/materials/plans/new'], {
      queryParams: { lessonId: 'l-1', studentId: 's-1', ai: '1' },
    });
  });

  it('offers nothing on a cancelled lesson without a plan', async () => {
    const root = await show(scheduledLesson({ status: 'CANCELLED' }));
    expect(root.querySelector('section')).toBeNull();
  });

  it('takes a plan from the bank: its copy goes on the lesson', async () => {
    const root = await show(scheduledLesson({ id: 'l-1' }));
    buttonByText(root, 'Из шаблонов').click();
    backend.expectOne('/api/teacher/textbooks/courses').flush([aCourse({ id: 'c-1', name: 'A2' })]);
    backend
      .expectOne('/api/teacher/textbooks/plans?bank=true')
      .flush([
        aPlanSummary({ id: 'b-2', title: 'Present Simple', courseId: 'c-1' }),
        aPlanSummary({ id: 'b-1', title: 'Articles', courseId: null }),
      ]);
    await settle();
    const choices = fixture.componentInstance.choices();
    expect(choices).toEqual([
      expect.objectContaining({ title: 'Articles', course: 'Без курса' }),
      expect.objectContaining({ title: 'Present Simple', course: 'A2' }),
    ]);
    expect(buttonByText(root, 'Взять').disabled).toBe(true);

    choose('b-2');
    buttonByText(root, 'Взять').click();
    const use = backend.expectOne({ method: 'POST', url: '/api/teacher/textbooks/plans/b-2/use' });
    expect(use.request.body).toEqual({ lessonId: 'l-1' });
    use.flush({ lessonId: 'l-1', plan: aLessonPlan({ id: 'p-7', bank: false }) });
    const link = backend.expectOne({
      method: 'PUT',
      url: '/api/teacher/schedule/lessons/l-1/plan',
    });
    expect(link.request.body).toEqual({ planId: 'p-7' });
    link.flush(scheduledLesson({ id: 'l-1', planId: 'p-7' }));
    await settle();
    expect(changed).toEqual([expect.objectContaining({ planId: 'p-7' })]);
    expect(messages).toHaveBeenLastCalledWith(
      expect.objectContaining({ detail: 'План из шаблона добавлен к уроку' }),
    );
  });

  it('deletes the copy that could not go on the lesson, and the picker can be closed', async () => {
    const root = await show(scheduledLesson({ id: 'l-1' }));
    buttonByText(root, 'Из шаблонов').click();
    backend
      .expectOne('/api/teacher/textbooks/courses')
      .flush({ status: 500 }, { status: 500, statusText: 'Server Error' });
    backend
      .expectOne('/api/teacher/textbooks/plans?bank=true')
      .flush([aPlanSummary({ id: 'b-1' })]);
    await settle();
    choose('b-1');
    buttonByText(root, 'Взять').click();
    backend
      .expectOne('/api/teacher/textbooks/plans/b-1/use')
      .flush({ lessonId: 'l-1', plan: aLessonPlan({ id: 'p-7', bank: false }) });
    backend
      .expectOne('/api/teacher/schedule/lessons/l-1/plan')
      .flush(
        { status: 422, code: 'schedule.lesson-cancelled' },
        { status: 422, statusText: 'Unprocessable' },
      );
    backend.expectOne({ method: 'DELETE', url: '/api/teacher/textbooks/plans/p-7' }).flush(null);
    await settle();
    expect(changed).toEqual([]);
    expect(messages).toHaveBeenLastCalledWith(expect.objectContaining({ severity: 'error' }));

    buttonByText(root, 'Отмена').click();
    await settle();
    expect(buttonByText(root, 'Из шаблонов')).toBeTruthy();
  });

  it('reports a bank that cannot be read', async () => {
    const root = await show(scheduledLesson({ id: 'l-1' }));
    buttonByText(root, 'Из шаблонов').click();
    backend.expectOne('/api/teacher/textbooks/courses').flush([]);
    backend
      .expectOne('/api/teacher/textbooks/plans?bank=true')
      .flush({ status: 500 }, { status: 500, statusText: 'Server Error' });
    await settle();
    expect(messages).toHaveBeenLastCalledWith(expect.objectContaining({ severity: 'error' }));
  });

  it('shows the plan of the lesson, opens it and takes it off the lesson', async () => {
    const root = await show(scheduledLesson({ id: 'l-1', planId: 'p-7' }));
    backend.expectOne('/api/teacher/textbooks/plans/p-7').flush(
      aLessonPlan({
        id: 'p-7',
        bank: false,
        title: 'Present Simple',
        videos: [
          {
            url: 'https://youtu.be/abc',
            provider: 'YOUTUBE',
            videoId: 'abc',
            startSeconds: null,
            title: null,
            transcript: null,
            transcriptShown: false,
          },
        ],
      }),
    );
    await settle();
    expect(root.textContent).toContain('Present Simple');
    expect(root.textContent).toContain('Spotlight 5');
    expect(root.textContent).toContain('Учебник · с. 12-14');
    expect(root.textContent).toContain('Видео 1');

    buttonByText(root, 'Открыть').click();
    expect(navigate).toHaveBeenCalledWith(['/teacher/materials/plans', 'p-7'], {
      queryParams: { lessonId: 'l-1' },
    });

    root.querySelector<HTMLButtonElement>('button[aria-label="Действия с планом"]')?.click();
    await settle();
    menuItemByText('Убрать из урока').click();
    await settle();
    expect(bodyText()).toContain('Шаблон останется');
    buttonByText(document.body, 'Убрать').click();
    await settle();
    const taken = backend.expectOne({
      method: 'PUT',
      url: '/api/teacher/schedule/lessons/l-1/plan',
    });
    expect(taken.request.body).toEqual({ planId: null });
    taken.flush(scheduledLesson({ id: 'l-1', planId: null }));
    backend.expectOne({ method: 'DELETE', url: '/api/teacher/textbooks/plans/p-7' }).flush(null);
    await settle();
    expect(changed).toEqual([expect.objectContaining({ planId: null })]);
    expect(messages).toHaveBeenLastCalledWith(
      expect.objectContaining({ detail: 'План убран из урока' }),
    );

    await show(scheduledLesson({ id: 'l-1', planId: null }));
    expect(root.textContent).toContain('Плана пока нет');
  });

  it('keeps the plan when taking it off fails, and retries a plan that cannot be read', async () => {
    const root = await show(scheduledLesson({ id: 'l-1', planId: 'p-7' }));
    backend
      .expectOne('/api/teacher/textbooks/plans/p-7')
      .flush({ status: 500 }, { status: 500, statusText: 'Server Error' });
    await settle();
    buttonByText(root, 'Повторить').click();
    backend.expectOne('/api/teacher/textbooks/plans/p-7').flush(aLessonPlan({ id: 'p-7' }));
    await settle();

    root.querySelector<HTMLButtonElement>('button[aria-label="Действия с планом"]')?.click();
    await settle();
    menuItemByText('Убрать из урока').click();
    await settle();
    buttonByText(document.body, 'Убрать').click();
    await settle();
    backend
      .expectOne('/api/teacher/schedule/lessons/l-1/plan')
      .flush({ status: 500 }, { status: 500, statusText: 'Server Error' });
    await settle();
    expect(changed).toEqual([]);
    expect(messages).toHaveBeenLastCalledWith(expect.objectContaining({ severity: 'error' }));
  });
});
