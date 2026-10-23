import { HttpTestingController, TestRequest } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { ConfirmationService, MessageService } from 'primeng/api';
import { aiStatus } from '@testing/ai-fixtures';
import { assignmentDetails, attachment, boundTextbook } from '@testing/homework-fixtures';
import { buttonByText, hostElement, readableText } from '@testing/dom';
import { groupLesson, scheduledLesson } from '@testing/schedule-fixtures';
import { HomeworkAiState } from '@features/ai/parts';
import { screenWidth, testProviders } from '@testing/setup';
import { By } from '@angular/platform-browser';
import { aBoard } from '@testing/boards-fixtures';
import { ToBoardDialog } from '@features/boards/parts';
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

/** «Выдать» and not «Выдать и поместить на доску». */
function exactButton(host: HTMLElement, text: string): HTMLButtonElement {
  const button = [...host.querySelectorAll('button')].find(
    (candidate) => candidate.textContent.trim() === text,
  );
  if (button === undefined) {
    throw new Error(`Button "${text}" not found`);
  }
  return button;
}

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
    expect(readableText(host)).not.toContain('Тип задания');
    page.form.patchValue({ title: '  Дроби ', description: 'Решите **№1**', studentIds: ['s-1'] });
    await fixture.whenStable();
    expect(page.form.controls.dueAt.value?.toISOString()).toBe(next.startsAt);
    expect(readableText(host)).toContain('До занятия');

    page.newFiles.set([new File(['x'], 'условие.pdf')]);
    page.pickTextbook(boundTextbook({ textbookId: 'tb-1', pages: '1-2' }));
    page.pickTextbook(boundTextbook({ textbookId: 'tb-1', pages: '3' }));
    await fixture.whenStable();
    exactButton(host, 'Выдать').click();

    const created = backend.expectOne({
      method: 'POST',
      url: '/api/teacher/homework/assignments',
    });
    expect(created.request.body).toEqual({
      title: 'Дроби',
      description: 'Решите **№1**',
      dueAt: next.startsAt,
      videos: [],
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

  it('resolves explicit recipients and ignores unavailable student IDs', async () => {
    const { page } = await create();
    page.form.controls.members.setValue([
      { kind: 'STUDENT', id: 's-2' },
      { kind: 'STUDENT', id: 's-4' },
    ]);
    await fixture.whenStable();
    expect(page.form.controls.studentIds.value).toEqual(['s-2']);
    page.form.controls.members.setValue([]);
    await fixture.whenStable();
    expect(page.form.controls.studentIds.value).toEqual([]);
  });

  it('switches the text and its preview', async () => {
    const { page, host } = await create();
    page.form.patchValue({ description: '**Жирный**' });

    expect(host.querySelector('#editor-text')).not.toBeNull();
    page.mode.setValue('preview');
    await fixture.whenStable();
    expect(host.querySelector('#editor-text')).toBeNull();
    expect(host.querySelector('.tb-preview strong')?.textContent).toBe('Жирный');
    expect(readableText(host)).not.toContain('На доску');
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

  it('gives the assignment out and puts it with its pages on a board of its students', async () => {
    const { page, host } = await create([]);
    const toBoard = buttonByText(host, 'Выдать и поместить на доску');
    expect(toBoard.disabled).toBe(true);

    page.form.patchValue({ title: 'Дроби', studentIds: ['s-1'] });
    page.pickTextbook(boundTextbook({ textbookId: 'tb-1', pages: '3' }));
    await fixture.whenStable();
    expect(toBoard.disabled).toBe(false);
    toBoard.click();
    backend
      .expectOne({ method: 'POST', url: '/api/teacher/homework/assignments' })
      .flush(assignmentDetails({ id: 'a-9', tasks: [], attachments: [] }));
    backend
      .expectOne('/api/teacher/homework/assignments/a-9/textbooks')
      .flush(assignmentDetails({ id: 'a-9' }));
    const saved = assignmentDetails({
      id: 'a-9',
      description: null,
      attachments: [],
      textbooks: [boundTextbook({ textbookId: 'tb-1', pages: '3' })],
    });
    backend.expectOne('/api/teacher/homework/assignments/a-9/students').flush(saved);
    await fixture.whenStable();
    expect(navigate).not.toHaveBeenCalled();

    backend.expectOne('/api/teacher/boards?studentId=s-1&studentId=s-2').flush([aBoard()]);
    await fixture.whenStable();
    const dialog = fixture.debugElement
      .query(By.directive(ToBoardDialog))
      .injector.get(ToBoardDialog);
    expect(dialog.pictures()).toEqual(['/api/teacher/textbooks/tb-1/pages/3']);
    expect(dialog.frame()).toMatch(/^Дроби · \d\d\.\d\d\.\d{4}$/);

    vi.spyOn(window, 'open').mockReturnValue(null);
    await dialog.place('text');
    const placed = backend.expectOne({
      method: 'PUT',
      url: '/api/teacher/homework/assignments/a-9/board',
    });
    expect(placed.request.body).toEqual({ boardId: 'board-1' });
    placed.flush(null, { status: 500, statusText: 'Error' });
    expect(TestBed.inject(MessageService).add).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'error' }),
    );

    dialog.visible.set(false);
    await fixture.whenStable();
    expect(navigate).toHaveBeenCalledWith(['/teacher/homework', 'a-9']);
    expect(page.canLeave()).toBe(true);
    localStorage.clear();
  });

  it('shows what the backend refused and saves materials that made it', async () => {
    const { page, host } = await create();
    page.form.patchValue({ title: 'Дроби' });
    page.save();
    page.save();
    backend
      .expectOne({ method: 'POST', url: '/api/teacher/homework/assignments' })
      .flush(
        { status: 422, code: 'assignment.title-invalid' },
        { status: 422, statusText: 'Unprocessable' },
      );
    await fixture.whenStable();
    expect(readableText(host)).toContain('Название задания — от 1 до 200 символов');

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

  it('edits an assignment without its materials: they are on its page', async () => {
    const details = assignmentDetails({
      textbooks: [boundTextbook()],
      attachments: [attachment()],
    });
    const { page, host } = await edit(details);
    const confirmation = TestBed.inject(ConfirmationService, null, { optional: true });
    expect(confirmation).toBeNull();

    expect(readableText(host)).toContain('Изменить задание');
    expect(readableText(host)).toContain('Сохранить и поместить на доску');
    expect(page.form.controls.title.value).toBe('Дроби');
    expect(page.form.controls.dueAt.value?.toISOString()).toBe('2026-09-10T15:00:00.000Z');
    expect(readableText(host)).not.toContain('Spotlight 5');
    expect(readableText(host)).not.toContain('условие.pdf');
    expect(readableText(host)).not.toContain('Привязать учебник');
    expect(host.querySelector('input[type="file"]')).toBeNull();

    page.form.patchValue({ title: 'Дроби 2' });
    page.form.markAsDirty();
    exactButton(host, 'Сохранить').click();
    const put = backend.expectOne({ method: 'PUT', url: '/api/teacher/homework/assignments/a-1' });
    expect(put.request.body).toMatchObject({ title: 'Дроби 2', version: 0 });
    put.flush(assignmentDetails({ title: 'Дроби 2', version: 1 }));
    await fixture.whenStable();

    backend.expectNone('/api/teacher/homework/assignments/a-1/attachments');
    expect(navigate).toHaveBeenCalledWith(['/teacher/homework', 'a-1']);
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

    for (const request of backend.match('/api/teacher/ai/prompts')) {
      request.flush([]);
    }
    const assistant = host.querySelector<HTMLElement>('tb-pane[kind="sheet"] tb-homework-ai-panel');
    expect(assistant).not.toBeNull();
    page.applyDraft({
      draft: { title: 'Проценты', description: '1. Найдите 10%' },
      mode: 'replace',
    });
    await fixture.whenStable();
    expect(page.form.controls.title.value).toBe('Проценты');
    expect(page.mode.value).toBe('preview');
    expect(host.querySelector('tb-pane[kind="sheet"] tb-homework-ai-panel')).toBe(assistant);
    expect(page.canLeave()).not.toBe(true);

    page.form.patchValue({ title: '' });
    page.applyDraft({
      draft: { title: 'Ещё', description: '2. Найдите 20%' },
      mode: 'insert',
    });
    expect(page.form.controls.title.value).toBe('Ещё');
    expect(page.form.controls.description.value).toBe('1. Найдите 10%\n\n2. Найдите 20%');
  });

  it('preserves AI request, sources and draft when the supporting pane is closed', async () => {
    const { page, host } = await create([], true);
    const state = fixture.debugElement.injector.get(HomeworkAiState);
    state.prompt.setValue('Create exercises');
    state.chosen.set(new Set(['textbook-tb-1']));
    state.draft.set({ title: 'Draft', description: 'Generated text' });
    exactButton(host, 'ИИ-помощник').click();
    await fixture.whenStable();
    expect(host.querySelector('tb-homework-ai-panel')).toBeNull();
    exactButton(host, 'ИИ-помощник').click();
    await fixture.whenStable();
    for (const request of backend.match('/api/teacher/ai/prompts')) request.flush([]);
    expect(state.prompt.value).toBe('Create exercises');
    expect(state.chosen().has('textbook-tb-1')).toBe(true);
    expect(readableText(host)).toContain('Generated text');
    expect(page.form.controls.description.value).toBe('');
  });

  it('opens the compact AI assistant as a modal panel and preserves its request on close', async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: testProviders(screenWidth(500)) });
    backend = TestBed.inject(HttpTestingController);
    const { host } = await create([], true);
    const state = fixture.debugElement.injector.get(HomeworkAiState);
    state.prompt.setValue('Keep this request');
    exactButton(host, 'ИИ-помощник').click();
    await fixture.whenStable();
    expect(document.body.querySelector('[role="dialog"][aria-modal="true"]')).not.toBeNull();
    const close = document.body.querySelector<HTMLButtonElement>(
      'button[aria-label="Закрыть ИИ-помощника"]',
    );
    expect(close).not.toBeNull();
    close?.click();
    await fixture.whenStable();
    expect(state.prompt.value).toBe('Keep this request');
    for (const request of backend.match('/api/teacher/ai/prompts')) request.flush([]);
  });

  it('offers the assistant the textbooks and the saved files it can read', async () => {
    const { page } = await edit(
      assignmentDetails({
        textbooks: [
          boundTextbook(),
          boundTextbook({ textbookId: 'w', title: 'Word', format: 'DOCUMENT' }),
        ],
        attachments: [
          attachment(),
          attachment({ id: 'z', filename: 'a.zip', contentType: 'application/zip' }),
        ],
      }),
    );

    expect(page.sourceOptions().map((option) => option.label)).toEqual([
      'Spotlight 5, с. 12-14',
      'условие.pdf',
    ]);
    expect(page.sourceOptions()[1]?.source).toEqual({
      type: 'FILE',
      id: 'f-1',
      assignmentId: 'a-1',
    });
  });

  it('edits the videos, saves them and offers their transcripts to the assistant', async () => {
    const video = {
      url: 'https://youtu.be/dQw4w9WgXcQ',
      provider: 'YOUTUBE' as const,
      videoId: 'dQw4w9WgXcQ',
      startSeconds: null,
      title: 'Present Simple',
      transcript: '[0:05] We play',
      transcriptShown: false,
    };
    const { page, host } = await edit(
      assignmentDetails({
        attachments: [],
        videos: [video, { ...video, title: null, transcript: null }],
      }),
    );

    expect(host.querySelector('iframe')).not.toBeNull();
    expect(page.sourceOptions().map((option) => option.label)).toEqual(['Видео: Present Simple']);
    expect(page.sourceOptions()[0]?.source).toEqual({
      type: 'VIDEO',
      title: 'Present Simple',
      url: 'https://youtu.be/dQw4w9WgXcQ',
      transcript: '[0:05] We play',
    });
    expect(page.canLeave()).toBe(true);

    page.changeVideos(page.videos().slice(0, 1));
    expect(page.canLeave()).not.toBe(true);
    exactButton(host, 'Сохранить').click();
    const put = backend.expectOne({ method: 'PUT', url: '/api/teacher/homework/assignments/a-1' });
    expect(put.request.body).toMatchObject({
      videos: [
        {
          url: 'https://youtu.be/dQw4w9WgXcQ',
          title: 'Present Simple',
          transcript: '[0:05] We play',
          transcriptShown: false,
        },
      ],
    });
    put.flush(assignmentDetails({ version: 1 }));
    await fixture.whenStable();
    expect(navigate).toHaveBeenCalledWith(['/teacher/homework', 'a-1']);
  });

  it('offers the assistant the textbooks and readable files picked for a new assignment', async () => {
    const { page } = await create();
    page.pickTextbook(boundTextbook({ pages: null }));
    const scan = new File(['png'], 'Скан.png', { type: 'image/png' });
    page.newFiles.set([scan, new File(['zip'], 'a.zip', { type: 'application/zip' })]);
    expect(page.sourceOptions().map((option) => option.label)).toEqual(['Spotlight 5', 'Скан.png']);
    expect(page.sourceOptions()[1]?.source).toBe(scan);
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
