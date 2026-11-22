import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { ConfirmationService } from 'primeng/api';
import { Snackbar } from '@core/snackbar/snackbar';
import { Observable, of, throwError } from 'rxjs';
import { buttonByText, hostElement, menuItemByText, readableText } from '@testing/dom';
import { EDITOR_STUDENTS, exactButton, lessonIn, useEditorHarness } from '@testing/homework-editor';
import { assignmentDetails } from '@testing/homework-fixtures';
import { groupLesson } from '@testing/schedule-fixtures';
import { aLessonPlan } from '@testing/textbooks-fixtures';
import { UpcomingLesson, type HomeworkLesson } from './next-lesson';

describe('AssignmentEditorPage for a lesson and for the bank', () => {
  const editor = useEditorHarness();

  /** The editor of `/teacher/homework/new?lessonId=…` with the lesson and the link the route gives. */
  async function forLesson(
    lesson: HomeworkLesson,
    lessons: readonly UpcomingLesson[],
    link: (lessonId: string, assignmentId: string) => Observable<unknown> = () => of({}),
  ) {
    const fixture = editor.open();
    fixture.componentRef.setInput('lessonId', lesson.id);
    fixture.componentRef.setInput('lessonOf', () => of(lesson));
    fixture.componentRef.setInput('linkToLesson', link);
    await fixture.whenStable();
    editor.backend.expectOne('/api/teacher/students').flush(EDITOR_STUDENTS);
    editor.backend
      .expectOne((request) => request.url === '/api/teacher/schedule/lessons')
      .flush(lessons);
    editor.flushStatus(false);
    editor.flushGroups();
    editor.flushCourses();
    return { page: fixture.componentInstance, host: hostElement(fixture) };
  }

  it('sets the homework of a lesson: its students, the plan’s course, pages and videos, the next lesson', async () => {
    const lesson = groupLesson({
      id: 'l-1',
      startsAt: lessonIn(1).startsAt,
      participants: [
        { studentId: 's-1', studentName: null, studentAvatar: null, attendance: 'EXPECTED' },
        { studentId: 's-2', studentName: null, studentAvatar: null, attendance: 'EXPECTED' },
      ],
      planId: 'p-1',
    });
    const next = lessonIn(3);
    const link = vi.fn(() => of({}));
    const { page, host } = await forLesson(lesson, [lessonIn(1), next], link);
    editor.backend.expectOne('/api/teacher/textbooks/plans/p-1').flush(
      aLessonPlan({
        courseId: 'c-1',
        bank: false,
        videos: [
          {
            url: 'https://youtu.be/x',
            provider: 'YOUTUBE',
            videoId: 'x',
            startSeconds: null,
            title: 'Видео',
            transcript: '[0:01] hi',
            transcriptShown: true,
          },
        ],
      }),
    );
    await editor.fixture.whenStable();
    expect(readableText(host)).toContain('Задание к уроку');
    expect(page.form.controls.members.value).toEqual([
      { kind: 'STUDENT', id: 's-1' },
      { kind: 'STUDENT', id: 's-2' },
    ]);
    expect(page.form.controls.courseId.value).toBe('c-1');
    expect(page.videos().map((video) => video.url)).toEqual(['https://youtu.be/x']);

    page.form.patchValue({ description: 'Дроби' });
    await editor.fixture.whenStable();
    exactButton(host, 'Выдать').click();
    const created = editor.backend.expectOne({
      method: 'POST',
      url: '/api/teacher/homework/assignments',
    });
    expect(created.request.body).toMatchObject({
      title: 'Дроби',
      dueAt: next.startsAt,
      courseId: 'c-1',
      videos: [
        {
          url: 'https://youtu.be/x',
          title: 'Видео',
          transcript: '[0:01] hi',
          transcriptShown: true,
        },
      ],
    });
    created.flush(assignmentDetails({ id: 'a-9', tasks: [] }));
    expect(link).toHaveBeenCalledWith('l-1', 'a-9');
    const bound = editor.backend.expectOne('/api/teacher/homework/assignments/a-9/textbooks');
    expect(bound.request.body).toEqual({ textbookId: 'tb-1', pages: '12-14' });
    bound.flush(assignmentDetails({ id: 'a-9', tasks: [] }));
    editor.backend
      .expectOne('/api/teacher/homework/assignments/a-9/students')
      .flush(assignmentDetails({ id: 'a-9' }));
    await editor.fixture.whenStable();
    expect(editor.navigateByUrl).toHaveBeenCalledWith('/teacher/schedule');
  });

  it('takes the course of the student without a plan, and tries a failed link again on the next save', async () => {
    const lesson = lessonIn(1);
    let fail = true;
    const link = vi.fn(() => (fail ? throwError(() => new Error('offline')) : of({})));
    const { page, host } = await forLesson({ ...lesson, planId: null }, [], link);
    editor.backend
      .expectOne('/api/teacher/textbooks/course-links')
      .flush({ students: [{ studentId: 's-1', courseId: 'c-7' }], groups: [] });
    await editor.fixture.whenStable();
    expect(page.form.controls.courseId.value).toBe('c-7');
    expect(page.form.controls.members.value).toEqual([{ kind: 'STUDENT', id: 's-1' }]);
    expect(host.querySelector('tb-editor-recipients')).not.toBeNull();

    page.autosaveDelay = 0;
    page.form.patchValue({ description: 'Дроби' });
    await editor.settle();
    editor.backend
      .expectOne({ method: 'POST', url: '/api/teacher/homework/assignments' })
      .flush(assignmentDetails({ id: 'a-3', tasks: [] }));
    await editor.settle();
    expect(link).toHaveBeenCalledTimes(1);
    expect(readableText(host)).toContain('Черновик не сохранился');

    fail = false;
    page.form.patchValue({ description: 'Дроби!' });
    await editor.settle();
    editor.backend
      .expectOne({ method: 'PUT', url: '/api/teacher/homework/assignments/a-3' })
      .flush(assignmentDetails({ id: 'a-3', tasks: [], version: 1 }));
    await editor.settle();
    expect(link).toHaveBeenLastCalledWith('l-1', 'a-3');
    editor.backend
      .match('/api/teacher/homework/assignments/a-3/draft-students')
      .forEach((request) => {
        request.flush(assignmentDetails({ id: 'a-3', tasks: [], version: 1 }));
      });
    editor.backend.match('/api/teacher/homework/assignments/a-3').forEach((request) => {
      request.flush(assignmentDetails({ id: 'a-3', tasks: [], version: 1 }));
    });
    await editor.settle();
  });

  it('leaves the editor alone when the lesson cannot be read', async () => {
    const fixture = editor.open();
    fixture.componentRef.setInput('lessonId', 'l-1');
    fixture.componentRef.setInput('lessonOf', () => throwError(() => new Error('offline')));
    await fixture.whenStable();
    editor.backend.expectOne('/api/teacher/students').flush(EDITOR_STUDENTS);
    editor.backend
      .expectOne((request) => request.url === '/api/teacher/schedule/lessons')
      .flush([]);
    editor.flushStatus(false);
    editor.flushGroups();
    editor.flushCourses();
    expect(fixture.componentInstance.form.controls.members.value).toEqual([]);
  });

  it('makes a bank item: no students or deadline, «Готово» leads to «Материалы»', async () => {
    const fixture = editor.open();
    fixture.componentRef.setInput('bank', 'true');
    // «Материалы» → «Создать» → «Задание» on a course
    fixture.componentRef.setInput('course', 'c-1');
    await fixture.whenStable();
    editor.backend.expectNone('/api/teacher/students');
    editor.backend.expectNone((request) => request.url === '/api/teacher/schedule/lessons');
    editor.flushStatus(false);
    editor.flushCourses();
    await fixture.whenStable();
    const page = fixture.componentInstance;
    const host = hostElement(fixture);
    expect(host.querySelector('h1')?.textContent.trim()).toBe('Новый шаблон задания');
    expect(readableText(host)).toContain('Это шаблон: ученикам');
    expect(host.querySelector('tb-editor-recipients')).toBeNull();
    expect(() => exactButton(host, 'Выдать')).toThrow();

    page.form.patchValue({ description: 'Глаголы' });
    await fixture.whenStable();
    buttonByText(host, 'Готово').click();
    const created = editor.backend.expectOne({
      method: 'POST',
      url: '/api/teacher/homework/assignments',
    });
    expect(created.request.body).toMatchObject({
      title: 'Глаголы',
      dueAt: null,
      bank: true,
      courseId: 'c-1',
    });
    created.flush(assignmentDetails({ id: 'b-1', tasks: [], bank: true }));
    await fixture.whenStable();
    editor.backend.expectNone('/api/teacher/homework/assignments/b-1/draft-students');
    const router = TestBed.inject(Router);
    expect(editor.navigateByUrl).toHaveBeenCalledWith(
      router.createUrlTree(['/teacher/materials'], { queryParams: { tab: 'assignments' } }),
    );
    expect(page.canLeave()).toBe(true);
  });

  it('asks for a text before «Готово» and reports a failed save', async () => {
    const { page, host } = await editor.edit(
      assignmentDetails({ id: 'b-1', tasks: [], bank: true, dueAt: null }),
    );
    expect(readableText(host)).toContain('Шаблон');
    expect(host.querySelector('button[aria-label="Ещё"]')).toBeNull();
    page.form.patchValue({ description: '' });
    await editor.fixture.whenStable();
    buttonByText(host, 'Готово').click();
    await editor.fixture.whenStable();
    expect(editor.navigateByUrl).not.toHaveBeenCalled();

    page.form.patchValue({ description: 'Дроби' });
    await editor.fixture.whenStable();
    buttonByText(host, 'Готово').click();
    editor.backend
      .expectOne({ method: 'PUT', url: '/api/teacher/homework/assignments/b-1' })
      .flush({}, { status: 500, statusText: 'Server Error' });
    editor.backend
      .expectOne('/api/teacher/homework/assignments/b-1')
      .flush(assignmentDetails({ id: 'b-1', tasks: [], bank: true }));
    await editor.fixture.whenStable();
    expect(editor.navigateByUrl).not.toHaveBeenCalled();
    expect(readableText(host)).toContain('Не удалось');
  });

  it('saves a given-out assignment to the bank from «⋮», and updates its original after asking', async () => {
    const success = vi.spyOn(TestBed.inject(Snackbar), 'success');
    const { host } = await editor.edit(assignmentDetails({ id: 'a-1' }));
    buttonByText(host, 'Ещё').click();
    await editor.fixture.whenStable();
    menuItemByText('Сохранить как шаблон').click();
    editor.backend
      .expectOne({ method: 'POST', url: '/api/teacher/homework/assignments/a-1/bank' })
      .flush(assignmentDetails({ id: 'a-1', sourceId: 'b-1' }));
    await editor.fixture.whenStable();
    expect(success).toHaveBeenCalledWith('Задание сохранено как шаблон');

    const confirm = vi
      .spyOn(TestBed.inject(ConfirmationService), 'confirm')
      .mockImplementation((options) => {
        options.accept?.();
        return TestBed.inject(ConfirmationService);
      });
    buttonByText(host, 'Ещё').click();
    await editor.fixture.whenStable();
    menuItemByText('Обновить шаблон').click();
    await editor.settle();
    expect(confirm).toHaveBeenCalled();
    editor.backend
      .expectOne({ method: 'POST', url: '/api/teacher/homework/assignments/a-1/bank' })
      .flush({}, { status: 500, statusText: 'Server Error' });
    editor.backend
      .expectOne('/api/teacher/homework/assignments/a-1')
      .flush(assignmentDetails({ id: 'a-1', sourceId: 'b-1' }));
    await editor.fixture.whenStable();
    expect(success).toHaveBeenCalledTimes(1);
  });

  it('saves the changes of a draft before it goes into the bank', async () => {
    const { page, host } = await editor.edit(assignmentDetails({ id: 'a-2', tasks: [] }));
    editor.backend.expectOne('/api/teacher/students').flush(EDITOR_STUDENTS);
    editor.flushGroups();
    page.autosaveDelay = 60_000;
    page.form.patchValue({ description: 'Новый текст' });
    await editor.fixture.whenStable();
    buttonByText(host, 'Ещё').click();
    await editor.fixture.whenStable();
    menuItemByText('Сохранить как шаблон').click();
    const updated = editor.backend.expectOne({
      method: 'PUT',
      url: '/api/teacher/homework/assignments/a-2',
    });
    expect(updated.request.body).toMatchObject({ description: 'Новый текст' });
    updated.flush(assignmentDetails({ id: 'a-2', tasks: [], version: 1 }));
    editor.backend
      .expectOne('/api/teacher/homework/assignments/a-2/draft-students')
      .flush(assignmentDetails({ id: 'a-2', tasks: [], version: 1 }));
    editor.backend
      .expectOne({ method: 'POST', url: '/api/teacher/homework/assignments/a-2/bank' })
      .flush(assignmentDetails({ id: 'a-2', tasks: [], version: 1, sourceId: 'b-2' }));
    await editor.fixture.whenStable();
    expect(buttonByText(host, 'Ещё')).toBeTruthy();
  });
});
