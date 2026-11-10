import { TestBed } from '@angular/core/testing';
import { MessageService } from 'primeng/api';
import { configureHomework, taskDetails } from '@testing/homework-fixtures';
import { aiStatus } from '@testing/ai-fixtures';
import { buttonByText, hostElement, readableText, requireElement } from '@testing/dom';
import { TaskReviewPage } from './task-review-page';
import { TaskDetails } from '../data-access/homework.models';

describe('TaskReviewPage', () => {
  async function render(details = taskDetails(), aiEnabled = false) {
    const context = configureHomework();
    const fixture = TestBed.createComponent(TaskReviewPage);
    const reviewed: TaskDetails[] = [];
    fixture.componentInstance.reviewed.subscribe((task) => reviewed.push(task));
    fixture.componentRef.setInput('taskId', 't-1');
    await fixture.whenStable();
    context.backend.expectOne('/api/teacher/homework/tasks/t-1').flush(details);
    await fixture.whenStable();
    // the review form under the answer asks whether the AI is on
    for (const request of context.backend.match('/api/teacher/ai/status')) {
      request.flush(aiStatus({ enabled: aiEnabled }));
    }
    await fixture.whenStable();
    return { ...context, fixture, host: hostElement(fixture), reviewed };
  }

  /** A grade chip of the review form by its exact label. */
  function chip(host: HTMLElement, label: string): HTMLButtonElement {
    const found = [...host.querySelectorAll<HTMLButtonElement>('.tb-filter-chip')].find(
      (button) => button.textContent.trim() === label,
    );
    if (found === undefined) {
      throw new Error(`Chip "${label}" not found`);
    }
    return found;
  }

  function comment(host: HTMLElement, text: string): void {
    const field = requireElement(host, '#sheet-comment', HTMLTextAreaElement);
    field.value = text;
    field.dispatchEvent(new Event('input'));
  }

  it('shows a failed load with «Повторить»', async () => {
    const { backend } = configureHomework();
    const fixture = TestBed.createComponent(TaskReviewPage);
    fixture.componentRef.setInput('taskId', 't-1');
    await fixture.whenStable();
    backend
      .expectOne('/api/teacher/homework/tasks/t-1')
      .flush(null, { status: 500, statusText: 'Error' });
    await fixture.whenStable();
    const host = hostElement(fixture);

    expect(readableText(host)).toContain('Не удалось загрузить работу');

    buttonByText(host, 'Повторить').click();
    backend.expectOne('/api/teacher/homework/tasks/t-1').flush(taskDetails());
    await fixture.whenStable();

    expect(readableText(host)).toContain('Мой ответ');
  });

  it('accepts a submission with a grade chip and a comment under the answer', async () => {
    const { fixture, host, backend, reviewed } = await render();
    expect(readableText(host.querySelector('.tb-sheet--inline')!)).toContain(
      'Оценка 3 4 5 Без оценки',
    );

    chip(host, '5').click();
    comment(host, 'Отлично');
    await fixture.whenStable();
    buttonByText(host, 'Принять').click();

    const request = backend.expectOne('/api/teacher/homework/tasks/t-1/review');
    expect(request.request.body).toEqual({ decision: 'ACCEPT', grade: '5', comment: 'Отлично' });
    request.flush(taskDetails({ status: 'ACCEPTED', grade: '5', teacherComment: 'Отлично' }));
    await fixture.whenStable();

    expect(readableText(host)).toContain('Оценка: 5');
    expect(reviewed.map((task) => task.status)).toEqual(['ACCEPTED']);
    expect(TestBed.inject(MessageService).add).toHaveBeenCalledWith(
      expect.objectContaining({ detail: 'Работа принята' }),
    );
    expect(host.textContent).not.toContain('Принять');
  });

  it('returns a submission for revision without a grade', async () => {
    const { host, backend } = await render(taskDetails({ grade: '4' }));

    chip(host, 'Без оценки').click();
    buttonByText(host, 'На доработку').click();

    const request = backend.expectOne('/api/teacher/homework/tasks/t-1/review');
    expect(request.request.body).toEqual({ decision: 'RETURN', grade: null, comment: null });
    request.flush(taskDetails({ status: 'RETURNED', teacherComment: 'Исправь' }));
  });

  it('shows the own comment on returned tasks and downloads files', async () => {
    const { host, backend, saved } = await render(
      taskDetails({
        status: 'RETURNED',
        teacherComment: 'Исправь №3',
        reviewedAt: '2026-09-06T10:00:00Z',
      }),
    );

    expect(readableText(host)).toContain('Ваш комментарий Исправь №3');
    expect(host.querySelector('tb-review-sheet')).toBeNull();
    buttonByText(host, 'решение.jpg').click();
    backend.expectOne('/api/teacher/homework/attachments/f-2').flush(new Blob(['jpg']));
    expect(saved).toEqual(['решение.jpg']);
  });

  it('keeps the form after a failed review', async () => {
    const { host, backend, reviewed } = await render();

    buttonByText(host, 'Принять').click();
    backend
      .expectOne('/api/teacher/homework/tasks/t-1/review')
      .flush(null, { status: 500, statusText: 'Error' });

    expect(buttonByText(host, 'Принять')).toBeDefined();
    expect(reviewed).toEqual([]);
  });

  it('offers the AI draft in the form under the answer', async () => {
    const { host } = await render(taskDetails(), true);

    expect(buttonByText(host, 'Черновик ИИ')).toBeDefined();
  });
});

describe('TaskReviewPage as a detail pane', () => {
  async function render(single: boolean, details = taskDetails()) {
    const context = configureHomework();
    const fixture = TestBed.createComponent(TaskReviewPage);
    fixture.componentRef.setInput('taskId', 't-1');
    fixture.componentRef.setInput('single', single);
    fixture.componentRef.setInput('sheet', true);
    await fixture.whenStable();
    context.backend.expectOne('/api/teacher/homework/tasks/t-1').flush(details);
    await fixture.whenStable();
    return { ...context, fixture, host: hostElement(fixture) };
  }

  it('titles the work with the student and the line «assignment · handed in · on time»', async () => {
    const { host } = await render(false);

    expect(host.querySelector('h1')?.textContent).toBe('Анна');
    expect(readableText(host.querySelector('.tb-task__meta')!)).toMatch(
      /^Дроби · сдано 05\.09 \d\d:\d\d · вовремя$/,
    );
    expect(host.querySelector('.tb-page-header__back')).toBeNull();
    expect(host.querySelector('tb-review-sheet')).toBeNull();
  });

  it('says «с опозданием», shows a status other than «На проверке» and the due date of a work not handed in', async () => {
    const base = taskDetails();
    const late = await render(false, {
      ...base,
      status: 'ACCEPTED',
      grade: '5',
      assignment: { ...base.assignment, dueAt: '2026-09-01T10:00:00Z' },
    });
    expect(readableText(late.host.querySelector('.tb-task__meta')!)).toMatch(
      /с опозданием Принято Оценка: 5$/,
    );
    TestBed.resetTestingModule();

    const waiting = await render(false, {
      ...base,
      status: 'ASSIGNED',
      submissions: [],
      submittedAt: null,
    });
    expect(readableText(waiting.host.querySelector('.tb-task__meta')!)).toMatch(
      /^Дроби · срок 10\.09\.2026 \d\d:\d\d Выдано$/,
    );
  });

  it('shows the place in the queue and opens the previous and the next work', async () => {
    const { fixture, host } = await render(false);
    const opened: string[] = [];
    fixture.componentInstance.opened.subscribe((id) => opened.push(id));
    fixture.componentRef.setInput('place', 2);
    fixture.componentRef.setInput('total', 3);
    fixture.componentRef.setInput('previous', 't-0');
    fixture.componentRef.setInput('next', { taskId: 't-2', studentName: 'Борис' });
    await fixture.whenStable();

    expect(readableText(host)).toContain('2 из 3 на проверке');
    requireElement(host, 'button[aria-label="Предыдущая работа"]', HTMLButtonElement).click();
    requireElement(host, 'button[aria-label="Следующая работа"]', HTMLButtonElement).click();
    expect(opened).toEqual(['t-0', 't-2']);

    fixture.componentRef.setInput('previous', null);
    fixture.componentRef.setInput('next', null);
    await fixture.whenStable();
    requireElement(host, 'button[aria-label="Предыдущая работа"]', HTMLButtonElement).click();
    requireElement(host, 'button[aria-label="Следующая работа"]', HTMLButtonElement).click();
    expect(opened).toEqual(['t-0', 't-2']);
  });

  it('has «back» to the list only on one pane', async () => {
    const { host } = await render(true);

    expect(host.querySelector('.tb-page-header__back')).not.toBeNull();
  });

  it('collapses the statement and opens it on a click', async () => {
    const { host, fixture } = await render(false);
    const head = host.querySelector<HTMLButtonElement>('.tb-task__statement-head')!;

    expect(head.getAttribute('aria-expanded')).toBe('false');
    expect(host.querySelector('tb-markdown')).toBeNull();

    head.click();
    await fixture.whenStable();

    expect(head.getAttribute('aria-expanded')).toBe('true');
    expect(host.querySelector('tb-markdown')).not.toBeNull();
  });

  it('links «Открыть на доске» when the assignment is on a board', async () => {
    const base = taskDetails();
    const { host } = await render(false, {
      ...base,
      assignment: { ...base.assignment, boardId: 'b-1' },
    });

    expect(host.querySelector('a[href="/teacher/boards/b-1"]')).not.toBeNull();
  });

  it('loads another work when the list opens it', async () => {
    const { fixture, backend } = await render(false);

    fixture.componentRef.setInput('taskId', 't-2');
    await fixture.whenStable();

    backend.expectOne('/api/teacher/homework/tasks/t-2').flush(taskDetails({ taskId: 't-2' }));
    await fixture.whenStable();
    expect(fixture.componentRef.instance.taskId()).toBe('t-2');
  });
});
