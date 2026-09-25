import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Router, provideRouter } from '@angular/router';
import { ConfirmationService, MessageService } from 'primeng/api';
import { providePrimeNG } from 'primeng/config';
import { FileSaver } from '@shared/files/file-saver';
import {
  assignmentDetails,
  assignmentSummary,
  attachment,
  reviewQueueItem,
  taskDetails,
} from '@testing/homework-fixtures';
import { aiStatus } from '@testing/ai-fixtures';
import { bodyText, buttonByText, hostElement, readableText } from '@testing/dom';
import { AssignmentDialog } from './assignment-dialog';
import { AssignmentPage } from './assignment-page';
import { AssignmentsPage } from './assignments-page';
import { ReviewQueuePage } from './review-queue-page';
import { TaskReviewPage } from './task-review-page';

const STUDENTS = [
  { id: 's-1', displayName: 'Анна', status: 'ACTIVE' },
  { id: 's-2', displayName: 'Борис', status: 'ACTIVE' },
  { id: 's-3', displayName: 'Вера', status: 'INVITED' },
  { id: 's-4', displayName: 'Гена', status: 'DEACTIVATED' },
].map((student) => ({
  ...student,
  email: null,
  phone: null,
  note: null,
  login: null,
  createdAt: '2026-09-01T10:00:00Z',
  version: 0,
  pendingInvite: null,
}));

function configure(): { backend: HttpTestingController; saved: string[] } {
  TestBed.configureTestingModule({
    providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([]), providePrimeNG(), MessageService],
  });
  const saved: string[] = [];
  vi.spyOn(TestBed.inject(FileSaver), 'save').mockImplementation((_blob, filename) => {
    saved.push(filename);
  });
  vi.spyOn(TestBed.inject(MessageService), 'add');
  return { backend: TestBed.inject(HttpTestingController), saved };
}

describe('AssignmentsPage', () => {
  it('lists assignments and creates a new one', async () => {
    const { backend } = configure();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(AssignmentsPage);
    await fixture.whenStable();
    backend
      .expectOne('/api/teacher/homework/assignments')
      .flush([assignmentSummary(), assignmentSummary({ id: 'a-2', title: 'Без срока', dueAt: null, submitted: 2 })]);
    await fixture.whenStable();
    const host = hostElement(fixture);

    expect(readableText(host)).toContain('На проверку 3');
    expect(readableText(host)).toContain('10.09.2026');
    expect(readableText(host)).toContain('без срока');
    expect(readableText(host)).toContain('0 из 2');

    buttonByText(host, 'Новое задание').click();
    backend.expectOne('/api/teacher/students').flush(STUDENTS);
    await fixture.whenStable();
    const dialog = fixture.debugElement.query(By.directive(AssignmentDialog)).injector.get(AssignmentDialog);
    expect(dialog.visible()).toBe(true);
    expect(dialog.students().map((student) => student.displayName)).toEqual(['Анна', 'Борис', 'Вера']);

    dialog.saved.emit(assignmentDetails({ id: 'a-9' }));
    expect(navigate).toHaveBeenCalledWith(['/teacher/homework', 'a-9']);
    fixture.destroy();
  });

  it('shows an empty state and survives load errors', async () => {
    const { backend } = configure();
    const fixture = TestBed.createComponent(AssignmentsPage);
    await fixture.whenStable();
    backend.expectOne('/api/teacher/homework/assignments').flush(null, { status: 500, statusText: 'Error' });
    await fixture.whenStable();

    expect(readableText(hostElement(fixture))).toContain('Заданий пока нет');
  });
});

describe('AssignmentPage', () => {
  async function render() {
    const context = configure();
    const fixture = TestBed.createComponent(AssignmentPage);
    fixture.componentRef.setInput('assignmentId', 'a-1');
    await fixture.whenStable();
    context.backend.expectOne('/api/teacher/homework/assignments/a-1').flush(assignmentDetails());
    context.backend.expectOne('/api/teacher/students').flush(STUDENTS);
    await fixture.whenStable();
    return { ...context, fixture, host: hostElement(fixture) };
  }

  it('shows the assignment, materials and progress', async () => {
    const { fixture, host, backend, saved } = await render();

    expect(host.querySelector('.tb-markdown strong')?.textContent).toBe('№1-5');
    expect(readableText(host)).toContain('Срок: 10.09.2026');
    expect(readableText(host)).toContain('Анна На проверке');
    expect(readableText(host)).toContain('Борис Выдано Просрочено');
    const reviewLink = host.querySelector('a[href="/teacher/homework/tasks/t-1"]');
    expect(reviewLink?.textContent.trim()).toBe('Проверить');
    expect(host.querySelector('a[href="/teacher/homework/tasks/t-2"]')?.textContent.trim()).toBe('Открыть');

    buttonByText(host, 'условие.pdf').click();
    backend.expectOne('/api/teacher/homework/attachments/f-1').flush(new Blob(['pdf']));
    expect(saved).toEqual(['условие.pdf']);
    fixture.destroy();
  });

  it('uploads and removes materials', async () => {
    const { fixture, host, backend } = await render();
    const confirmation = fixture.debugElement.injector.get(ConfirmationService);
    vi.spyOn(confirmation, 'confirm').mockImplementation((options) => {
      options.accept?.();
      return confirmation;
    });

    const picker = host.querySelector('input[type="file"]');
    if (!(picker instanceof HTMLInputElement)) {
      throw new Error('file input missing');
    }
    Object.defineProperty(picker, 'files', { value: [new File(['x'], 'схема.png')], configurable: true });
    picker.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    buttonByText(host, 'Загрузить').click();
    backend
      .expectOne('/api/teacher/homework/assignments/a-1/attachments')
      .flush([attachment({ id: 'f-3', filename: 'схема.png' })]);
    await fixture.whenStable();
    expect(readableText(host)).toContain('схема.png');

    buttonByText(host, 'Удалить файл условие.pdf').click();
    backend.expectOne({ method: 'DELETE', url: '/api/teacher/homework/assignments/a-1/attachments/f-1' }).flush(null);
    await fixture.whenStable();
    expect(readableText(host)).not.toContain('условие.pdf');
    fixture.destroy();
  });

  it('gives the assignment to more students', async () => {
    const { fixture, host, backend } = await render();

    fixture.componentInstance.toAssign.setValue(['s-3']);
    await fixture.whenStable();
    buttonByText(host, 'Выдать').click();

    expect(backend.expectOne('/api/teacher/homework/assignments/a-1/students').request.body).toEqual({
      studentIds: ['s-3'],
    });
    fixture.destroy();
  });
});

describe('ReviewQueuePage', () => {
  it('lists submitted tasks', async () => {
    const { backend } = configure();
    const fixture = TestBed.createComponent(ReviewQueuePage);
    await fixture.whenStable();
    backend
      .expectOne('/api/teacher/homework/review-queue')
      .flush([reviewQueueItem(), reviewQueueItem({ taskId: 't-2', submittedAt: null, dueAt: '2026-09-10T15:00:00Z' })]);
    await fixture.whenStable();

    expect(readableText(hostElement(fixture))).toContain('Анна Дроби 05.09.2026');
    expect(hostElement(fixture).querySelectorAll('a[href="/teacher/homework/tasks/t-1"]')).toHaveLength(1);
  });

  it('shows that everything is reviewed', async () => {
    const { backend } = configure();
    const fixture = TestBed.createComponent(ReviewQueuePage);
    await fixture.whenStable();
    backend.expectOne('/api/teacher/homework/review-queue').flush(null, { status: 500, statusText: 'Error' });
    await fixture.whenStable();

    expect(readableText(hostElement(fixture))).toContain('Всё проверено');
  });
});

describe('TaskReviewPage', () => {
  async function render(details = taskDetails(), aiEnabled = false) {
    const context = configure();
    const fixture = TestBed.createComponent(TaskReviewPage);
    fixture.componentRef.setInput('taskId', 't-1');
    context.backend.expectOne('/api/teacher/ai/status').flush(aiStatus({ enabled: aiEnabled }));
    await fixture.whenStable();
    context.backend.expectOne('/api/teacher/homework/tasks/t-1').flush(details);
    await fixture.whenStable();
    return { ...context, fixture, host: hostElement(fixture) };
  }

  it('accepts a submission with a grade', async () => {
    const { fixture, host, backend } = await render();
    expect(readableText(host)).toContain('Мой ответ');

    fixture.componentInstance.form.setValue({ grade: ' 5 ', comment: 'Отлично' });
    await fixture.whenStable();
    buttonByText(host, 'Принять').click();

    const request = backend.expectOne('/api/teacher/homework/tasks/t-1/review');
    expect(request.request.body).toEqual({ decision: 'ACCEPT', grade: '5', comment: 'Отлично' });
    request.flush(taskDetails({ status: 'ACCEPTED', grade: '5', teacherComment: 'Отлично' }));
    await fixture.whenStable();

    expect(readableText(host)).toContain('Оценка: 5');
    expect(TestBed.inject(MessageService).add).toHaveBeenCalledWith(expect.objectContaining({ detail: 'Работа принята' }));
    expect(host.textContent).not.toContain('Принять');
  });

  it('returns a submission for revision', async () => {
    const { host, backend } = await render();

    buttonByText(host, 'Вернуть на доработку').click();

    const request = backend.expectOne('/api/teacher/homework/tasks/t-1/review');
    expect(request.request.body).toEqual({ decision: 'RETURN', grade: null, comment: null });
    request.flush(taskDetails({ status: 'RETURNED', teacherComment: 'Исправь' }));
  });

  it('shows the own comment on returned tasks and downloads files', async () => {
    const { host, backend, saved } = await render(
      taskDetails({ status: 'RETURNED', teacherComment: 'Исправь №3', reviewedAt: '2026-09-06T10:00:00Z' }),
    );

    expect(readableText(host)).toContain('Ваш комментарий Исправь №3');
    buttonByText(host, 'решение.jpg').click();
    backend.expectOne('/api/teacher/homework/attachments/f-2').flush(new Blob(['jpg']));
    expect(saved).toEqual(['решение.jpg']);
  });

  it('keeps the form after a failed review', async () => {
    const { host, backend } = await render();

    buttonByText(host, 'Принять').click();
    backend.expectOne('/api/teacher/homework/tasks/t-1/review').flush(null, { status: 500, statusText: 'Error' });

    expect(buttonByText(host, 'Принять')).toBeDefined();
  });

  it('fills the form with an AI review draft', async () => {
    const details = taskDetails();
    const { fixture, host, backend } = await render(details, true);

    buttonByText(host, 'Черновик проверки').click();
    const request = backend.expectOne('/api/teacher/ai/review-draft');
    expect(request.request.body).toEqual({
      title: details.assignment.title,
      description: details.assignment.description,
      answer: details.submissions[0]?.text,
    });
    request.flush({ comment: 'Почти верно, проверь №2', grade: '4', accept: false });
    await fixture.whenStable();

    expect(fixture.componentInstance.form.getRawValue()).toEqual({ grade: '4', comment: 'Почти верно, проверь №2' });
    expect(readableText(host)).toContain('ИИ предлагает вернуть работу на доработку');
  });

  it('suggests accepting and tolerates a missing grade', async () => {
    const { fixture, host, backend } = await render(taskDetails(), true);

    buttonByText(host, 'Черновик проверки').click();
    backend.expectOne('/api/teacher/ai/review-draft').flush({ comment: 'Отлично', grade: null, accept: true });
    await fixture.whenStable();

    expect(fixture.componentInstance.form.controls.grade.value).toBe('');
    expect(readableText(host)).toContain('ИИ предлагает принять работу');
  });

  it('keeps the form when the AI draft fails', async () => {
    const { fixture, host, backend } = await render(taskDetails(), true);

    buttonByText(host, 'Черновик проверки').click();
    backend.expectOne('/api/teacher/ai/review-draft').flush(null, { status: 422, statusText: 'Unprocessable' });
    await fixture.whenStable();

    expect(fixture.componentInstance.form.controls.comment.value).toBe('');
    expect(buttonByText(host, 'Черновик проверки')).toBeDefined();
  });

  it('offers no AI draft without a text answer or when AI is off', async () => {
    const withoutText = taskDetails();
    const filesOnly = { ...withoutText, submissions: withoutText.submissions.map((s) => ({ ...s, text: null })) };
    const { host } = await render(filesOnly, true);
    expect(bodyText()).not.toContain('Черновик проверки');
    expect(host.textContent).toContain('Принять');
  });

  it('hides the AI draft when AI is off', async () => {
    const { host } = await render(taskDetails(), false);

    expect(host.textContent).not.toContain('Черновик проверки');
  });
});
