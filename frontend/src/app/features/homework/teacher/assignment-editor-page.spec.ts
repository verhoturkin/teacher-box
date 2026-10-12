import { HttpTestingController, TestRequest } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { ConfirmationService, MessageService } from 'primeng/api';
import { aiStatus } from '@testing/ai-fixtures';
import { assignmentDetails, attachment, boundTextbook } from '@testing/homework-fixtures';
import { buttonByText, hostElement, readableText } from '@testing/dom';
import { groupLesson, scheduledLesson } from '@testing/schedule-fixtures';
import { testProviders } from '@testing/setup';
import { AssignmentEditorPage } from './assignment-editor-page';

const STUDENTS = [
  { id: 's-1', displayName: 'Анна', status: 'ACTIVE' },
  { id: 's-2', displayName: 'Борис', status: 'ACTIVE' },
  { id: 's-4', displayName: 'Гена', status: 'DEACTIVATED' },
].map((student) => ({
  ...student,
  avatar: null,
  email: null,
  phone: null,
  note: null,
  login: null,
  createdAt: '2026-09-01T10:00:00Z',
  version: 0,
  pendingInvite: null,
}));

const DAY = 24 * 60 * 60 * 1000;

describe('AssignmentEditorPage', () => {
  let backend: HttpTestingController;
  let navigate: ReturnType<typeof vi.spyOn>;
  let fixture: ComponentFixture<AssignmentEditorPage>;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: testProviders() });
    backend = TestBed.inject(HttpTestingController);
    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    vi.spyOn(TestBed.inject(MessageService), 'add');
  });

  afterEach(() => {
    fixture.destroy();
    vi.restoreAllMocks();
  });

  function flushStatus(enabled: boolean): void {
    for (const request of backend.match('/api/teacher/ai/status')) {
      request.flush(aiStatus({ enabled }));
    }
  }

  function flushGroups(): void {
    for (const request of backend.match((r) => r.url.startsWith('/api/teacher/groups'))) {
      request.flush([]);
    }
  }

  async function create(lessons = [scheduledLesson()], ai = false) {
    fixture = TestBed.createComponent(AssignmentEditorPage);
    await fixture.whenStable();
    backend.expectOne('/api/teacher/students').flush(STUDENTS);
    backend.expectOne((request) => request.url === '/api/teacher/schedule/lessons').flush(lessons);
    flushStatus(ai);
    flushGroups();
    await fixture.whenStable();
    return { page: fixture.componentInstance, host: hostElement(fixture) };
  }

  async function edit(details = assignmentDetails()) {
    fixture = TestBed.createComponent(AssignmentEditorPage);
    fixture.componentRef.setInput('assignmentId', details.id);
    await fixture.whenStable();
    backend.expectOne(`/api/teacher/homework/assignments/${details.id}`).flush(details);
    flushStatus(false);
    await fixture.whenStable();
    return { page: fixture.componentInstance, host: hostElement(fixture) };
  }

  function lessonIn(days: number, studentId = 's-1') {
    const starts = new Date(Date.now() + days * DAY);
    starts.setSeconds(0, 0);
    return scheduledLesson({
      id: `l-${String(days)}`,
      studentId,
      participants: [{ studentId, studentName: null, studentAvatar: null, attendance: 'EXPECTED' }],
      startsAt: starts.toISOString(),
    });
  }

  it('creates written homework, adds its materials, then gives it out', async () => {
    const next = lessonIn(2);
    const { page, host } = await create([lessonIn(5), next, lessonIn(1, 's-9')]);

    expect(readableText(host)).toContain('Новое задание');
    expect(readableText(host)).toContain('Текст, учебники и файлы');
    page.form.patchValue({ title: '  Дроби ', description: 'Решите **№1**', studentIds: ['s-1'] });
    await fixture.whenStable();
    expect(page.form.controls.dueAt.value?.toISOString()).toBe(next.startsAt);
    expect(readableText(host)).toContain('До занятия');

    page.newFiles.set([new File(['x'], 'условие.pdf')]);
    page.pickTextbook(boundTextbook({ textbookId: 'tb-1', pages: '1-2' }));
    page.pickTextbook(boundTextbook({ textbookId: 'tb-1', pages: '3' }));
    await fixture.whenStable();
    buttonByText(host, 'Выдать').click();

    const created = backend.expectOne({
      method: 'POST',
      url: '/api/teacher/homework/assignments',
    });
    expect(created.request.body).toEqual({
      kind: 'WRITTEN',
      title: 'Дроби',
      description: 'Решите **№1**',
      interactiveHtml: null,
      dueAt: next.startsAt,
    });
    created.flush(assignmentDetails({ id: 'a-9', tasks: [] }));
    backend.expectOne('/api/teacher/homework/assignments/a-9/attachments').flush([attachment()]);
    const bound = backend.expectOne('/api/teacher/homework/assignments/a-9/textbooks');
    expect(bound.request.body).toEqual({ textbookId: 'tb-1', pages: '3' });
    bound.flush(assignmentDetails({ id: 'a-9' }));
    const assigned = backend.expectOne('/api/teacher/homework/assignments/a-9/students');
    expect(assigned.request.body).toEqual({ studentIds: ['s-1'] });
    assigned.flush(assignmentDetails({ id: 'a-9' }));
    await fixture.whenStable();

    expect(navigate).toHaveBeenCalledWith(['/teacher/homework', 'a-9']);
    expect(TestBed.inject(MessageService).add).toHaveBeenCalledWith(
      expect.objectContaining({ detail: 'Задание выдано' }),
    );
    expect(page.canLeave()).toBe(true);
  });

  it('offers only current students and takes those of a group', async () => {
    const { page } = await create();

    page.addStudents(['s-2', 's-4', 's-2']);

    expect(page.form.controls.studentIds.value).toEqual(['s-2']);
  });

  it('keeps the due date the teacher set and says when there is no lesson', async () => {
    const { page, host } = await create([
      groupLesson({ startsAt: new Date(Date.now() + DAY).toISOString() }),
    ]);

    page.form.patchValue({ studentIds: ['s-3'] });
    await fixture.whenStable();
    expect(page.form.controls.dueAt.value).toBeNull();
    expect(readableText(host)).toContain('Ближайших занятий у выбранных учеников нет');

    page.form.patchValue({ studentIds: ['s-2'] });
    await fixture.whenStable();
    expect(page.form.controls.dueAt.value).not.toBeNull();

    const chosen = new Date(2030, 0, 10, 12);
    page.form.controls.dueAt.setValue(chosen);
    page.form.patchValue({ studentIds: ['s-1', 's-2'] });
    await fixture.whenStable();
    expect(page.form.controls.dueAt.value).toBe(chosen);
    expect(readableText(host)).not.toContain('До занятия');
  });

  it('works without the schedule', async () => {
    fixture = TestBed.createComponent(AssignmentEditorPage);
    await fixture.whenStable();
    backend.expectOne('/api/teacher/students').flush(STUDENTS);
    backend
      .expectOne((request) => request.url === '/api/teacher/schedule/lessons')
      .flush(null, { status: 500, statusText: 'Error' });
    flushStatus(false);
    flushGroups();
    fixture.componentInstance.form.patchValue({ studentIds: ['s-1'] });
    await fixture.whenStable();

    expect(fixture.componentInstance.form.controls.dueAt.value).toBeNull();
    expect(readableText(hostElement(fixture))).not.toContain('Ближайших занятий');
  });

  it('creates interactive homework with a preview of its page', async () => {
    const { page, host } = await create();
    page.kind.setValue('INTERACTIVE');
    await fixture.whenStable();

    expect(host.querySelector('#editor-text')).toBeNull();
    expect(readableText(host)).not.toContain('Учебники');
    buttonByText(host, 'Показать страницу').click();
    backend.expectNone('/api/teacher/homework/interactive-preview');

    page.form.patchValue({ title: 'Тест', interactiveHtml: '<p>2 + 2 = ?</p>' });
    buttonByText(host, 'Показать страницу').click();
    const preview = backend.expectOne('/api/teacher/homework/interactive-preview');
    expect(preview.request.body).toEqual({ html: '<p>2 + 2 = ?</p>' });
    preview.flush({
      url: '/api/public/homework/interactive/p1',
      expiresAt: '2030-01-01T00:00:00Z',
    });
    await fixture.whenStable();
    expect(host.querySelector('iframe')?.getAttribute('src')).toBe(
      '/api/public/homework/interactive/p1',
    );

    buttonByText(host, 'Показать страницу').click();
    backend
      .expectOne('/api/teacher/homework/interactive-preview')
      .flush(null, { status: 500, statusText: 'Error' });
    await fixture.whenStable();
    expect(readableText(host)).toContain('Не удалось показать страницу');

    page.newFiles.set([new File(['x'], 'лишний.pdf')]);
    page.save();
    const created = backend.expectOne({ method: 'POST', url: '/api/teacher/homework/assignments' });
    expect(created.request.body).toMatchObject({
      kind: 'INTERACTIVE',
      interactiveHtml: '<p>2 + 2 = ?</p>',
    });
    created.flush(assignmentDetails({ id: 'a-7', kind: 'INTERACTIVE' }));
    await fixture.whenStable();
    expect(navigate).toHaveBeenCalledWith(['/teacher/homework', 'a-7']);
    expect(TestBed.inject(MessageService).add).toHaveBeenCalledWith(
      expect.objectContaining({ detail: 'Задание сохранено' }),
    );
  });

  it('shows what the backend refused and saves materials that made it', async () => {
    const { page, host } = await create();
    page.form.patchValue({ title: 'Дроби' });
    page.save();
    page.save();
    backend
      .expectOne({ method: 'POST', url: '/api/teacher/homework/assignments' })
      .flush(
        { status: 422, code: 'assignment.html-required' },
        { status: 422, statusText: 'Unprocessable' },
      );
    await fixture.whenStable();
    expect(readableText(host)).toContain('Для интерактивного задания нужен HTML-код');

    page.newFiles.set([new File(['x'], 'virus.exe')]);
    page.save();
    backend
      .expectOne({ method: 'POST', url: '/api/teacher/homework/assignments' })
      .flush(assignmentDetails({ id: 'a-8' }));
    backend
      .expectOne('/api/teacher/homework/assignments/a-8/attachments')
      .flush(null, { status: 422, statusText: 'Unprocessable' });
    await fixture.whenStable();

    expect(navigate).toHaveBeenCalledWith(['/teacher/homework', 'a-8']);
    expect(TestBed.inject(MessageService).add).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'error' }),
    );
  });

  it('needs a title', async () => {
    const { page } = await create();

    page.save();

    backend.expectNone('/api/teacher/homework/assignments');
    expect(page.form.controls.title.touched).toBe(true);
  });

  it('edits an assignment: its kind stays, materials change at once', async () => {
    const details = assignmentDetails({
      kind: 'WRITTEN',
      textbooks: [boundTextbook()],
      attachments: [attachment()],
    });
    const { page, host } = await edit(details);
    const confirmation = TestBed.inject(ConfirmationService, null, { optional: true });
    expect(confirmation).toBeNull();

    expect(readableText(host)).toContain('Изменить задание');
    expect(readableText(host)).not.toContain('Тип задания');
    expect(page.form.controls.title.value).toBe('Дроби');
    expect(page.form.controls.dueAt.value?.toISOString()).toBe('2026-09-10T15:00:00.000Z');

    host
      .querySelector<HTMLButtonElement>('button[aria-label="Убрать из задания: Spotlight 5"]')
      ?.click();
    backend
      .expectOne({ method: 'DELETE', url: '/api/teacher/homework/assignments/a-1/textbooks/tb-1' })
      .flush({ ...details, textbooks: [] });
    await fixture.whenStable();
    expect(readableText(host)).not.toContain('Spotlight 5');

    page.form.patchValue({ title: 'Дроби 2' });
    page.form.markAsDirty();
    page.newFiles.set([new File(['x'], 'ещё.pdf')]);
    buttonByText(host, 'Сохранить').click();
    const put = backend.expectOne({ method: 'PUT', url: '/api/teacher/homework/assignments/a-1' });
    expect(put.request.body).toMatchObject({ title: 'Дроби 2', version: 0 });
    put.flush(assignmentDetails({ title: 'Дроби 2', version: 1 }));
    backend.expectOne('/api/teacher/homework/assignments/a-1/attachments').flush([]);
    await fixture.whenStable();

    expect(navigate).toHaveBeenCalledWith(['/teacher/homework', 'a-1']);
  });

  it('removes a file of an assignment after a confirmation and downloads files', async () => {
    const { host } = await edit();
    const confirmation = fixture.debugElement.injector.get(ConfirmationService);
    vi.spyOn(confirmation, 'confirm').mockImplementation((request) => {
      request.accept?.();
      return confirmation;
    });

    buttonByText(host, 'условие.pdf').click();
    expect(backend.expectOne('/api/teacher/homework/attachments/f-1').request.responseType).toBe(
      'blob',
    );
    host.querySelector<HTMLButtonElement>('button[aria-label="Удалить файл условие.pdf"]')?.click();
    backend
      .expectOne({ method: 'DELETE', url: '/api/teacher/homework/assignments/a-1/attachments/f-1' })
      .flush(null);
    await fixture.whenStable();

    expect(host.querySelector('button[aria-label="Удалить файл условие.pdf"]')).toBeNull();
  });

  it('shows the kind of an interactive assignment and keeps its page', async () => {
    const { page, host } = await edit(
      assignmentDetails({ kind: 'INTERACTIVE', interactiveHtml: '<p>?</p>' }),
    );

    expect(readableText(host)).toContain('Интерактивное');
    expect(page.form.controls.interactiveHtml.value).toBe('<p>?</p>');
  });

  it('asks before leaving unsaved work', async () => {
    const { page } = await create();
    const confirmation = fixture.debugElement.injector.get(ConfirmationService);
    const answers: boolean[] = [true, false];
    vi.spyOn(confirmation, 'confirm').mockImplementation((request) => {
      if (answers.shift() === true) {
        request.accept?.();
      } else {
        request.reject?.();
      }
      return confirmation;
    });

    expect(page.canLeave()).toBe(true);
    page.form.controls.title.setValue('Черновик');
    page.form.markAsDirty();

    await expect(page.canLeave()).resolves.toBe(true);
    await expect(page.canLeave()).resolves.toBe(false);
  });

  it('puts an AI draft into the editor', async () => {
    const { page, host } = await create([], true);

    expect(readableText(host)).toContain('ИИ-помощник');
    page.applyDraft({ title: 'Проценты', description: '1. Найдите 10%' });
    await fixture.whenStable();

    expect(page.form.controls.title.value).toBe('Проценты');
    expect(page.mode.value).toBe('preview');
    expect(page.canLeave()).not.toBe(true);
  });

  it('shows a failed load with «Повторить»', async () => {
    fixture = TestBed.createComponent(AssignmentEditorPage);
    fixture.componentRef.setInput('assignmentId', 'a-1');
    await fixture.whenStable();
    flushStatus(false);
    backend
      .expectOne('/api/teacher/homework/assignments/a-1')
      .flush(null, { status: 500, statusText: 'Error' });
    await fixture.whenStable();

    expect(readableText(hostElement(fixture))).toContain('Не удалось загрузить задание');
    buttonByText(hostElement(fixture), 'Повторить').click();
    const retry: TestRequest = backend.expectOne('/api/teacher/homework/assignments/a-1');
    retry.flush(assignmentDetails());
  });
});
