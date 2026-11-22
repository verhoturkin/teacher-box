import { Location } from '@angular/common';
import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, of, throwError } from 'rxjs';
import { MessageService } from 'primeng/api';
import { bodyText, buttonByText, hostElement, menuItemByText } from '@testing/dom';
import { ConfirmHost, testProviders } from '@testing/setup';
import { aCourse, aLessonPlan } from '@testing/textbooks-fixtures';
import { LessonPlan } from '../data-access/lesson-plans.models';
import { LessonPlanEditorPage } from './lesson-plan-editor-page';

describe('LessonPlanEditorPage', () => {
  let fixture: ComponentFixture<LessonPlanEditorPage>;
  let backend: HttpTestingController;
  let page: LessonPlanEditorPage;
  let host: HTMLElement;
  let navigateByUrl: ReturnType<typeof vi.spyOn>;
  let messages: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: testProviders() });
    backend = TestBed.inject(HttpTestingController);
    navigateByUrl = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    messages = vi.spyOn(TestBed.inject(MessageService), 'add');
    TestBed.createComponent(ConfirmHost).detectChanges();
  });

  afterEach(() => {
    backend.verify();
    fixture.destroy();
    vi.restoreAllMocks();
  });

  async function settle(): Promise<void> {
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
  }

  async function open(planId?: string, plan: LessonPlan = aLessonPlan()): Promise<void> {
    fixture = TestBed.createComponent(LessonPlanEditorPage);
    if (planId !== undefined) fixture.componentRef.setInput('planId', planId);
    page = fixture.componentInstance;
    page.autosaveDelay = 0;
    fixture.detectChanges();
    backend
      .expectOne('/api/teacher/textbooks/courses')
      .flush([aCourse({ id: 'c-1', name: 'Английский' }), aCourse({ id: 'c-2', name: 'ОГЭ' })]);
    if (planId !== undefined) {
      backend.expectOne(`/api/teacher/textbooks/plans/${planId}`).flush(plan);
    }
    await settle();
    host = hostElement(fixture);
  }

  it('creates a bank item by itself once it has a title, then keeps updating it', async () => {
    await open();
    expect(host.querySelector('h1')?.textContent).toContain('Новый план урока');
    expect(host.textContent).toContain('Поддерживается Markdown');
    page.form.patchValue({ body: 'Разминка' });
    await settle();
    backend.expectNone('/api/teacher/textbooks/plans');

    page.form.patchValue({ title: ' Present Simple ', courseId: 'c-1' });
    await settle();
    const created = backend.expectOne({ method: 'POST', url: '/api/teacher/textbooks/plans' });
    expect(created.request.body).toEqual({
      title: 'Present Simple',
      body: 'Разминка',
      courseId: 'c-1',
      textbooks: [],
      videos: [],
      bank: true,
    });
    created.flush(aLessonPlan({ id: 'p-9', textbooks: [] }));
    await settle();
    expect(TestBed.inject(Location).path()).toBe('/teacher/materials/plans/p-9');
    expect(host.textContent).toMatch(/сохранено · \d\d:\d\d/);
    expect(host.textContent).toContain('В банке');
    expect(host.querySelector('button[aria-label="Ещё"]')).toBeNull();

    page.form.patchValue({ body: 'Разминка, чтение' });
    await settle();
    const updated = backend.expectOne({ method: 'PUT', url: '/api/teacher/textbooks/plans/p-9' });
    expect(updated.request.body).toEqual(
      expect.objectContaining({ body: 'Разминка, чтение', version: 0 }),
    );
    updated.flush(aLessonPlan({ id: 'p-9', textbooks: [], version: 1 }));
    await settle();
    expect(page.canLeave()).toBe(true);
  });

  it('edits the textbooks of the course and finishes with «Готово»', async () => {
    await open('p-1');
    expect(host.querySelector('h1')?.textContent).toContain('Present Simple');
    expect(host.textContent).toContain('Spotlight 5');
    expect(host.textContent).toContain('Учебник · с. 12-14');
    expect(host.textContent).toContain('1 из 20');

    host
      .querySelector<HTMLButtonElement>('button[aria-label="Изменить страницы: Spotlight 5"]')
      ?.click();
    await settle();
    expect(bodyText()).toContain('Страницы учебника');
    buttonByText(document.body, 'Отмена').click();
    await settle();

    buttonByText(host, 'Добавить учебник').click();
    await settle();
    backend.expectOne('/api/teacher/textbooks').flush([]);
    await settle();
    expect(bodyText()).toContain('Учебник к плану');
    expect(bodyText()).toContain('Свободных учебников курса нет');
    buttonByText(document.body, 'Закрыть').click();
    await settle();

    page.pickTextbook({
      textbookId: 'tb-2',
      kind: 'WORKBOOK',
      title: 'Тетрадь',
      courseName: null,
      format: 'DOCUMENT',
      pageCount: null,
      pages: null,
    });
    page.pickTextbook({
      textbookId: 'tb-1',
      kind: 'TEXTBOOK',
      title: 'Spotlight 5',
      courseName: null,
      format: 'PDF',
      pageCount: 120,
      pages: '3',
    });
    await settle();
    const saved = backend.expectOne({ method: 'PUT', url: '/api/teacher/textbooks/plans/p-1' });
    expect(saved.request.body).toEqual(
      expect.objectContaining({
        textbooks: [
          { textbookId: 'tb-1', pages: '3' },
          { textbookId: 'tb-2', pages: null },
        ],
      }),
    );
    saved.flush(aLessonPlan({ version: 1 }));
    await settle();
    expect(host.textContent).toContain('Рабочая тетрадь · весь учебник');

    host.querySelector<HTMLButtonElement>('button[aria-label="Убрать Тетрадь"]')?.click();
    await settle();
    buttonByText(host, 'Готово').click();
    const put = backend.expectOne({ method: 'PUT', url: '/api/teacher/textbooks/plans/p-1' });
    expect(put.request.body).toEqual(
      expect.objectContaining({ textbooks: [{ textbookId: 'tb-1', pages: '3' }], version: 1 }),
    );
    put.flush(aLessonPlan({ version: 2 }));
    backend
      .expectOne({ method: 'POST', url: '/api/teacher/textbooks/plans/p-1/finish' })
      .flush(aLessonPlan({ version: 2 }));
    await settle();
    expect(navigateByUrl).toHaveBeenCalledWith(
      TestBed.inject(Router).createUrlTree(['/teacher/materials'], {
        queryParams: { tab: 'plans' },
      }),
    );
    expect(page.canLeave()).toBe(true);
    backend.expectNone('/api/teacher/textbooks/plans/p-1');
  });

  it('saves a lesson plan into the bank, and updates the original after asking', async () => {
    await open('p-3', aLessonPlan({ id: 'p-3', bank: false }));
    expect(host.textContent).not.toContain('В банке');
    host.querySelector<HTMLButtonElement>('button[aria-label="Ещё"]')?.click();
    await settle();
    menuItemByText('Сохранить в банк').click();
    await settle();
    backend
      .expectOne({ method: 'POST', url: '/api/teacher/textbooks/plans/p-3/bank' })
      .flush(aLessonPlan({ id: 'p-3', bank: false, sourceId: 'p-1' }));
    await settle();
    expect(messages).toHaveBeenLastCalledWith(
      expect.objectContaining({ detail: 'План сохранён в банк' }),
    );

    page.form.patchValue({ body: 'Новый ход урока' });
    host.querySelector<HTMLButtonElement>('button[aria-label="Ещё"]')?.click();
    await fixture.whenStable();
    menuItemByText('Обновить в банке').click();
    await fixture.whenStable();
    expect(bodyText()).toContain('Оригинал в банке заменится этим планом');
    buttonByText(document.body, 'Обновить').click();
    await settle();
    const put = backend.expectOne({ method: 'PUT', url: '/api/teacher/textbooks/plans/p-3' });
    put.flush(aLessonPlan({ id: 'p-3', bank: false, sourceId: 'p-1', version: 1 }));
    backend
      .expectOne({ method: 'POST', url: '/api/teacher/textbooks/plans/p-3/bank' })
      .flush(
        { status: 404, code: 'textbooks.plan-not-found' },
        { status: 404, statusText: 'Not Found' },
      );
    backend
      .expectOne('/api/teacher/textbooks/plans/p-3')
      .flush(aLessonPlan({ id: 'p-3', bank: false, sourceId: 'p-1', version: 1 }));
    await settle();
    expect(messages).toHaveBeenLastCalledWith(expect.objectContaining({ severity: 'error' }));
  });

  it('keeps the plan when the update in the bank is not confirmed', async () => {
    await open('p-3', aLessonPlan({ id: 'p-3', bank: false, sourceId: 'p-1' }));
    host.querySelector<HTMLButtonElement>('button[aria-label="Ещё"]')?.click();
    await fixture.whenStable();
    menuItemByText('Обновить в банке').click();
    await fixture.whenStable();
    buttonByText(document.body, 'Отмена').click();
    await settle();
    backend.expectNone('/api/teacher/textbooks/plans/p-3/bank');
  });

  it('reports a failed autosave and a failed «Готово», and needs a title to finish', async () => {
    await open('p-1');
    page.form.patchValue({ title: '' });
    buttonByText(host, 'Готово').click();
    await settle();
    backend.expectNone('/api/teacher/textbooks/plans/p-1/finish');

    page.form.patchValue({ title: 'Present' });
    await settle();
    backend
      .expectOne({ method: 'PUT', url: '/api/teacher/textbooks/plans/p-1' })
      .flush({ status: 409, code: 'conflict' }, { status: 409, statusText: 'Conflict' });
    backend.expectOne('/api/teacher/textbooks/plans/p-1').flush(aLessonPlan({ version: 4 }));
    await settle();
    expect(host.textContent).toContain('Не удалось сохранить план');

    buttonByText(host, 'Готово').click();
    backend
      .expectOne({ method: 'PUT', url: '/api/teacher/textbooks/plans/p-1' })
      .flush(aLessonPlan({ title: 'Present', version: 5 }));
    backend
      .expectOne('/api/teacher/textbooks/plans/p-1/finish')
      .flush({ status: 500 }, { status: 500, statusText: 'Server Error' });
    backend.expectOne('/api/teacher/textbooks/plans/p-1').flush(aLessonPlan({ version: 5 }));
    await settle();
    expect(host.textContent).toContain('Не удалось завершить план');
    expect(navigateByUrl).not.toHaveBeenCalled();
  });

  /** Opens a new plan of a lesson; `link` stands for the route's link to the lesson. */
  async function openForLesson(
    owner: { studentId: string } | { groupId: string },
    link: (lessonId: string, planId: string) => Observable<unknown>,
  ): Promise<void> {
    fixture = TestBed.createComponent(LessonPlanEditorPage);
    fixture.componentRef.setInput('lessonId', 'l-1');
    for (const [key, value] of Object.entries(owner)) fixture.componentRef.setInput(key, value);
    fixture.componentRef.setInput('linkToLesson', link);
    page = fixture.componentInstance;
    page.autosaveDelay = 0;
    fixture.detectChanges();
    backend
      .expectOne('/api/teacher/textbooks/courses')
      .flush([aCourse({ id: 'c-1' }), aCourse({ id: 'c-2' })]);
    backend.expectOne('/api/teacher/textbooks/course-links').flush({
      students: [{ studentId: 's-1', courseId: 'c-2' }],
      groups: [{ groupId: 'g-1', courseId: 'c-1' }],
    });
    await settle();
    host = hostElement(fixture);
  }

  it('makes a lesson its working plan with the student’s course and puts it on the lesson once', async () => {
    const link = vi.fn<(lessonId: string, planId: string) => Observable<unknown>>(() => of({}));
    await openForLesson({ studentId: 's-1' }, link);
    expect(page.form.controls.courseId.value).toBe('c-2');
    expect(host.textContent).toContain('План этого урока');
    expect(host.querySelector('[aria-label="К расписанию"]')).not.toBeNull();

    page.form.patchValue({ title: 'Present Simple' });
    await settle();
    const created = backend.expectOne({ method: 'POST', url: '/api/teacher/textbooks/plans' });
    expect(created.request.body).toEqual(
      expect.objectContaining({ title: 'Present Simple', courseId: 'c-2', bank: false }),
    );
    created.flush(aLessonPlan({ id: 'p-9', bank: false, courseId: 'c-2' }));
    await settle();
    expect(link).toHaveBeenCalledWith('l-1', 'p-9');
    expect(TestBed.inject(Location).path()).toBe('/teacher/materials/plans/p-9?lessonId=l-1');

    buttonByText(host, 'Готово').click();
    backend
      .expectOne({ method: 'POST', url: '/api/teacher/textbooks/plans/p-9/finish' })
      .flush(aLessonPlan({ id: 'p-9', bank: false, sourceId: 'p-10' }));
    await settle();
    expect(link).toHaveBeenCalledTimes(1);
    expect(navigateByUrl).toHaveBeenCalledWith(
      TestBed.inject(Router).createUrlTree(['/teacher/schedule']),
    );
  });

  it('keeps a plan whose link failed and links it at the next save; a group lesson takes the group’s course', async () => {
    const link = vi
      .fn<(lessonId: string, planId: string) => Observable<unknown>>()
      .mockReturnValueOnce(
        throwError(
          () =>
            new HttpErrorResponse({
              status: 422,
              error: { status: 422, code: 'schedule.lesson-cancelled' },
            }),
        ),
      )
      .mockReturnValue(of({}));
    await openForLesson({ groupId: 'g-1' }, link);
    expect(page.form.controls.courseId.value).toBe('c-1');

    page.form.patchValue({ title: 'Present' });
    await settle();
    backend
      .expectOne({ method: 'POST', url: '/api/teacher/textbooks/plans' })
      .flush(aLessonPlan({ id: 'p-9', bank: false }));
    backend
      .expectOne('/api/teacher/textbooks/plans/p-9')
      .flush(aLessonPlan({ id: 'p-9', bank: false }));
    await settle();
    expect(host.querySelector('p-message')).not.toBeNull();

    page.form.patchValue({ title: 'Present Simple' });
    await settle();
    backend
      .expectOne({ method: 'PUT', url: '/api/teacher/textbooks/plans/p-9' })
      .flush(aLessonPlan({ id: 'p-9', bank: false, version: 1 }));
    await settle();
    expect(link).toHaveBeenCalledTimes(2);
    expect(link).toHaveBeenLastCalledWith('l-1', 'p-9');
    expect(host.querySelector('p-message')).toBeNull();
  });

  it('saves what is left when the teacher leaves', async () => {
    await open('p-1');
    page.autosaveDelay = 60_000;
    page.form.patchValue({ body: 'Ещё строка' });
    await fixture.whenStable();
    expect(page.canLeave()).toBe(true);
    backend
      .expectOne({ method: 'PUT', url: '/api/teacher/textbooks/plans/p-1' })
      .flush(aLessonPlan());
    expect(page.autosaveDelay).toBe(60_000);
  });

  it('offers a retry when the plan cannot be read', async () => {
    fixture = TestBed.createComponent(LessonPlanEditorPage);
    fixture.componentRef.setInput('planId', 'p-1');
    fixture.detectChanges();
    backend.expectOne('/api/teacher/textbooks/courses').flush([]);
    backend
      .expectOne('/api/teacher/textbooks/plans/p-1')
      .flush({ status: 404 }, { status: 404, statusText: 'Not Found' });
    await fixture.whenStable();
    host = hostElement(fixture);
    buttonByText(host, 'Повторить').click();
    backend.expectOne('/api/teacher/textbooks/plans/p-1').flush(aLessonPlan({ courseId: null }));
    await fixture.whenStable();
    expect(host.querySelector<HTMLInputElement>('#plan-title')?.value).toBe('Present Simple');
    expect(host.querySelector('#plan-course')).toBeNull();
  });
});
