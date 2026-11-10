import { Snackbar } from '@core/snackbar/snackbar';
import { TestRequest } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Location } from '@angular/common';
import { ConfirmationService, MessageService } from 'primeng/api';
import { assignmentDetails, attachment, boundTextbook } from '@testing/homework-fixtures';
import { buttonByText, hostElement, readableText } from '@testing/dom';
import { By } from '@angular/platform-browser';
import { aBoard } from '@testing/boards-fixtures';
import { ToBoardDialog } from '@features/boards/parts';
import { exactButton, lessonIn, useEditorHarness } from '@testing/homework-editor';
import { AssignmentEditorPage } from './assignment-editor-page';
import { questionDraft } from './question-drafts';
import { videoDraft } from './video-section';

describe('AssignmentEditorPage', () => {
  const editor = useEditorHarness();

  it('creates written homework, adds its materials, then gives it out', async () => {
    const link = vi.spyOn(TestBed.inject(Snackbar), 'link');
    const next = lessonIn(2);
    const { page, host } = await editor.create([lessonIn(5), next, lessonIn(1, 's-9')]);

    expect(readableText(host)).toContain('Новое задание');
    expect(readableText(host)).not.toContain('Тип задания');
    page.form.patchValue({
      description: '## Дроби\nРешите **№1**',
      members: [{ kind: 'STUDENT', id: 's-1' }],
    });
    await editor.fixture.whenStable();
    expect(readableText(host)).toContain('К следующему занятию');

    page.newFiles.set([new File(['x'], 'условие.pdf')]);
    page.pickTextbook(boundTextbook({ textbookId: 'tb-1', pages: '1-2' }));
    page.pickTextbook(boundTextbook({ textbookId: 'tb-1', pages: '3' }));
    await editor.fixture.whenStable();
    exactButton(host, 'Выдать').click();

    const created = editor.backend.expectOne({
      method: 'POST',
      url: '/api/teacher/homework/assignments',
    });
    expect(created.request.body).toEqual({
      title: 'Дроби',
      description: '## Дроби\nРешите **№1**',
      dueAt: next.startsAt,
      videos: [],
    });
    created.flush(assignmentDetails({ id: 'a-9', tasks: [] }));
    editor.backend
      .expectOne('/api/teacher/homework/assignments/a-9/attachments')
      .flush([attachment()]);
    const bound = editor.backend.expectOne('/api/teacher/homework/assignments/a-9/textbooks');
    expect(bound.request.body).toEqual({ textbookId: 'tb-1', pages: '3' });
    bound.flush(assignmentDetails({ id: 'a-9' }));
    const assigned = editor.backend.expectOne('/api/teacher/homework/assignments/a-9/students');
    expect(assigned.request.body).toEqual({ studentIds: ['s-1'] });
    assigned.flush(assignmentDetails({ id: 'a-9' }));
    await editor.fixture.whenStable();

    // back where the editor was opened (the list); «Открыть» of the snackbar leads to the assignment
    expect(editor.navigateByUrl).toHaveBeenCalledWith('/teacher/homework');
    expect(link).toHaveBeenCalledWith('Задание выдано', 'Открыть', expect.any(Function));
    link.mock.calls[0]?.[2]();
    expect(editor.navigate).toHaveBeenCalledWith(['/teacher/homework', 'a-9']);
    expect(page.canLeave()).toBe(true);
  });

  it('saves a new draft by itself with its students, then keeps updating it', async () => {
    const { page, host } = await editor.create([]);
    page.autosaveDelay = 0;
    expect(readableText(host)).not.toContain('Сохранить черновик');
    page.form.patchValue({
      description: 'Дроби',
      members: [
        { kind: 'STUDENT', id: 's-2' },
        { kind: 'STUDENT', id: 's-4' },
      ],
    });
    await editor.settle();
    const created = editor.backend.expectOne({
      method: 'POST',
      url: '/api/teacher/homework/assignments',
    });
    expect(created.request.body).not.toHaveProperty('questions');
    created.flush(assignmentDetails({ id: 'a-7', tasks: [], version: 0 }));
    const kept = editor.backend.expectOne('/api/teacher/homework/assignments/a-7/draft-students');
    expect(kept.request.body).toEqual({ studentIds: ['s-2'] });
    kept.flush(assignmentDetails({ id: 'a-7', tasks: [], version: 0 }));
    await editor.settle();

    editor.backend.expectNone('/api/teacher/homework/assignments/a-7/students');
    expect(editor.navigate).not.toHaveBeenCalled();
    expect(TestBed.inject(Location).path()).toBe('/teacher/homework/a-7/edit');
    expect(readableText(host)).toMatch(/сохранено · \d\d:\d\d/);
    expect(host.querySelector('h1')?.textContent.trim()).toBe('Дроби');

    page.form.patchValue({ description: 'Дроби\nРешите' });
    await editor.settle();
    const updated = editor.backend.expectOne({
      method: 'PUT',
      url: '/api/teacher/homework/assignments/a-7',
    });
    expect(updated.request.body).toMatchObject({ description: 'Дроби\nРешите', version: 0 });
    updated.flush(assignmentDetails({ id: 'a-7', tasks: [], version: 1 }));
    editor.backend
      .expectOne('/api/teacher/homework/assignments/a-7/draft-students')
      .flush(assignmentDetails({ id: 'a-7', tasks: [], version: 1 }));
    await editor.settle();
    editor.backend.expectNone({ method: 'PUT', url: '/api/teacher/homework/assignments/a-7' });
    expect(page.canLeave()).toBe(true);
  });

  it('saves nothing without a title and the rest when leaving', async () => {
    const { page } = await editor.create([]);
    page.autosaveDelay = 0;
    page.form.patchValue({ members: [{ kind: 'STUDENT', id: 's-1' }] });
    await editor.settle();
    editor.backend.expectNone({ method: 'POST', url: '/api/teacher/homework/assignments' });

    page.autosaveDelay = 60_000;
    page.form.patchValue({ description: 'Дроби' });
    await editor.fixture.whenStable();
    expect(page.canLeave()).toBe(true);
    editor.backend
      .expectOne({ method: 'POST', url: '/api/teacher/homework/assignments' })
      .flush(
        { status: 422, code: 'assignment.title-invalid' },
        { status: 422, statusText: 'Unprocessable' },
      );
  });

  it('needs a text for the title and students to give out to', async () => {
    const { page, host } = await editor.create([]);

    page.save();
    await editor.fixture.whenStable();
    expect(readableText(host)).toContain('Напишите текст задания');

    page.form.patchValue({ description: '\n  \n**Дроби**' });
    page.save();
    await editor.fixture.whenStable();
    expect(readableText(host)).toContain('Выберите, кому выдать задание');
    editor.backend.expectNone('/api/teacher/homework/assignments');
  });

  it('derives the title from the first line: no marks, at most 200 characters', async () => {
    const { page } = await editor.create([]);
    page.form.patchValue({
      description: `\n- [**${'я'.repeat(250)}**](https://x.y)\nТекст`,
      members: [{ kind: 'STUDENT', id: 's-1' }],
    });
    page.save();
    const created = editor.backend.expectOne({
      method: 'POST',
      url: '/api/teacher/homework/assignments',
    });
    expect(created.request.body).toMatchObject({ title: 'я'.repeat(200) });
  });

  it('hides the empty sections and adds a video from the section menu', async () => {
    const { page, host } = await editor.create([]);
    expect(host.querySelector('h1')?.textContent.trim()).toBe('Новое задание');
    expect(host.querySelector('tb-textbook-list li')).toBeNull();
    expect(host.querySelector('tb-video-section')).toBeNull();
    expect(host.querySelector('tb-question-section')).toBeNull();
    // the materials are files and textbooks: the video, the board and the test live elsewhere
    const materials = host.querySelector<HTMLElement>('tb-material-chips') ?? host;
    expect(readableText(materials)).not.toMatch(/Видео|Доска|Тест/);

    const add = () => [...host.querySelectorAll<HTMLButtonElement>('.tb-section-nav__action')];
    expect(add().map((button) => button.textContent.trim())).toEqual(['Видео', 'Доску']);
    add()[0]?.click();
    await editor.fixture.whenStable();
    expect(host.querySelector('tb-video-section')).not.toBeNull();
    expect(page.videos()).toHaveLength(0);
    expect(document.activeElement?.id).toBe('video-link');

    page.pickTextbook(boundTextbook());
    page.newFiles.set([new File(['x'], 'условие.pdf')]);
    page.changeVideos(Array.from({ length: 5 }, () => videoDraft()));
    await editor.fixture.whenStable();
    expect(host.querySelector('tb-textbook-list li')).not.toBeNull();
    expect(add()[0]?.disabled).toBe(true);
  });

  it('switches the text and its preview', async () => {
    const { page, host } = await editor.create();
    page.form.patchValue({ description: '**Жирный**' });

    expect(host.querySelector('#editor-text')).not.toBeNull();
    page.mode.setValue('preview');
    await editor.fixture.whenStable();
    expect(host.querySelector('#editor-text')).toBeNull();
    expect(host.querySelector('.tb-preview strong')?.textContent).toBe('Жирный');
    expect(readableText(host)).not.toContain('На доску');
  });

  it('gives the assignment out and puts it with its pages on a board of its students', async () => {
    const { page, host } = await editor.create([]);
    page.form.patchValue({ description: 'Дроби', members: [{ kind: 'STUDENT', id: 's-1' }] });
    page.pickTextbook(boundTextbook({ textbookId: 'tb-1', pages: '3' }));
    await editor.fixture.whenStable();
    exactButton(host, 'Доску').click();
    editor.backend.expectOne('/api/teacher/boards').flush([aBoard()]);
    await editor.fixture.whenStable();
    document.body.querySelector<HTMLElement>('.p-menu-item-link')?.click();
    await editor.fixture.whenStable();
    const board = readableText(host.querySelector<HTMLElement>('#editor-board') ?? host);
    expect(board).toContain('Алгебра');
    expect(board).toContain('когда вы его выдадите');
    expect(host.querySelector('.tb-section-nav__action:nth-child(2)')).toBeNull();
    exactButton(host, 'Выдать').click();
    editor.backend
      .expectOne({ method: 'POST', url: '/api/teacher/homework/assignments' })
      .flush(assignmentDetails({ id: 'a-9', tasks: [], attachments: [] }));
    editor.backend
      .expectOne('/api/teacher/homework/assignments/a-9/textbooks')
      .flush(assignmentDetails({ id: 'a-9' }));
    const saved = assignmentDetails({
      id: 'a-9',
      description: null,
      attachments: [],
      textbooks: [boundTextbook({ textbookId: 'tb-1', pages: '3' })],
    });
    editor.backend.expectOne('/api/teacher/homework/assignments/a-9/students').flush(saved);
    await editor.fixture.whenStable();
    expect(editor.navigate).not.toHaveBeenCalled();

    editor.backend.expectOne('/api/teacher/boards?studentId=s-1&studentId=s-2').flush([aBoard()]);
    await editor.fixture.whenStable();
    const dialog = editor.fixture.debugElement
      .query(By.directive(ToBoardDialog))
      .injector.get(ToBoardDialog);
    expect(dialog.pictures()).toEqual(['/api/teacher/textbooks/tb-1/pages/3']);
    expect(dialog.frame()).toMatch(/^Дроби · \d\d\.\d\d\.\d{4}$/);

    vi.spyOn(window, 'open').mockReturnValue(null);
    await dialog.place('text');
    const placed = editor.backend.expectOne({
      method: 'PUT',
      url: '/api/teacher/homework/assignments/a-9/board',
    });
    expect(placed.request.body).toEqual({ boardId: 'board-1' });
    placed.flush(null, { status: 500, statusText: 'Error' });
    expect(TestBed.inject(MessageService).add).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'error' }),
    );

    dialog.visible.set(false);
    await editor.fixture.whenStable();
    expect(editor.navigateByUrl).toHaveBeenCalledWith('/teacher/homework');
    expect(page.canLeave()).toBe(true);
    localStorage.clear();
  });

  it('shows what the editor.backend refused and saves materials that made it', async () => {
    const { page, host } = await editor.create();
    page.form.patchValue({ description: 'Дроби', members: [{ kind: 'STUDENT', id: 's-1' }] });
    page.save();
    page.save();
    editor.backend
      .expectOne({ method: 'POST', url: '/api/teacher/homework/assignments' })
      .flush(
        { status: 422, code: 'assignment.title-invalid' },
        { status: 422, statusText: 'Unprocessable' },
      );
    await editor.fixture.whenStable();
    expect(readableText(host)).toContain('Название задания — от 1 до 200 символов');

    page.newFiles.set([new File(['x'], 'virus.exe')]);
    page.save();
    editor.backend
      .expectOne({ method: 'POST', url: '/api/teacher/homework/assignments' })
      .flush(assignmentDetails({ id: 'a-8' }));
    editor.backend
      .expectOne('/api/teacher/homework/assignments/a-8/attachments')
      .flush(null, { status: 422, statusText: 'Unprocessable' });
    editor.backend
      .expectOne('/api/teacher/homework/assignments/a-8/students')
      .flush(assignmentDetails({ id: 'a-8' }));
    await editor.fixture.whenStable();

    expect(editor.navigateByUrl).toHaveBeenCalledWith('/teacher/homework');
    expect(TestBed.inject(MessageService).add).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'error' }),
    );
  });

  it('lists the shown sections in a column and drops it beside the AI', async () => {
    const { page, host } = await editor.create([], true);
    const labels = () =>
      [...host.querySelectorAll('tb-section-nav a')].map((item) => item.textContent.trim());
    expect(labels()).toEqual(['Текст']);

    page.changeQuestions([{ ...questionDraft('NUMBER'), text: 'Вопрос', value: 1 }]);
    page.changeVideos([...page.videos(), videoDraft()]);
    await editor.fixture.whenStable();
    expect(labels()).toEqual(['Текст', 'Видео · 1', 'Тест · 1']);

    exactButton(host, 'ИИ-помощник').click();
    await editor.fixture.whenStable();
    expect(host.querySelector('tb-section-nav')).toBeNull();
  });

  it('asks before leaving unsaved changes of an issued assignment', async () => {
    const { page } = await editor.edit();
    const confirmation = editor.fixture.debugElement.injector.get(ConfirmationService);
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
    page.form.controls.description.setValue('Черновик');
    page.form.markAsDirty();

    await expect(page.canLeave()).resolves.toBe(true);
    await expect(page.canLeave()).resolves.toBe(false);
  });

  it('shows a failed load with «Повторить»', async () => {
    editor.fixture = TestBed.createComponent(AssignmentEditorPage);
    editor.fixture.componentRef.setInput('assignmentId', 'a-1');
    await editor.fixture.whenStable();
    editor.flushStatus(false);
    editor.backend
      .expectOne('/api/teacher/homework/assignments/a-1')
      .flush(null, { status: 500, statusText: 'Error' });
    await editor.fixture.whenStable();

    expect(readableText(hostElement(editor.fixture))).toContain('Не удалось загрузить задание');
    buttonByText(hostElement(editor.fixture), 'Повторить').click();
    const retry: TestRequest = editor.backend.expectOne('/api/teacher/homework/assignments/a-1');
    retry.flush(assignmentDetails());
  });
});
