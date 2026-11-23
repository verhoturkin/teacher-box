import { HttpTestingController, TestRequest } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import type { MockInstance } from 'vitest';
import { buttonByText, hostElement, menuItemByText } from '@testing/dom';
import { assignmentDetails, assignmentSummary } from '@testing/homework-fixtures';
import { testProviders } from '@testing/setup';
import { groupLesson, scheduledLesson } from '@testing/schedule-fixtures';
import { ScheduledLesson } from '../data-access/schedule.models';
import { LessonHomeworkSection, lessonStudents } from './lesson-homework-section';

const ASSIGNMENTS = '/api/teacher/homework/assignments';
const BANK = '/api/teacher/homework/assignments?bank=true';

describe('LessonHomeworkSection', () => {
  let fixture: ComponentFixture<LessonHomeworkSection>;
  let backend: HttpTestingController;
  let navigate: ReturnType<typeof vi.spyOn>;
  let messages: MockInstance<MessageService['add']>;
  let changed: ScheduledLesson[];

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: testProviders() });
    backend = TestBed.inject(HttpTestingController);
    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    messages = vi.spyOn(TestBed.inject(MessageService), 'add');
    fixture = TestBed.createComponent(LessonHomeworkSection);
    changed = [];
    fixture.componentInstance.changed.subscribe((lesson) => changed.push(lesson));
  });

  afterEach(() => {
    backend.verify();
    vi.restoreAllMocks();
  });

  async function show(lesson: ScheduledLesson): Promise<HTMLElement> {
    fixture.componentRef.setInput('lesson', lesson);
    await fixture.whenStable();
    return hostElement(fixture);
  }

  function lessonsRequest(): TestRequest {
    return backend.expectOne((request) => request.url === '/api/teacher/schedule/lessons');
  }

  function choose(key: string): void {
    fixture.componentInstance.chosen.set(key);
    fixture.detectChanges();
  }

  /** «+ ДЗ» → an item of its menu. */
  async function add(root: HTMLElement, item: string): Promise<void> {
    root
      .querySelector<HTMLButtonElement>('button[aria-label="Добавить домашнее задание"]')
      ?.click();
    await fixture.whenStable();
    menuItemByText(item).click();
    await fixture.whenStable();
  }

  /** Opens the row «ДЗ: …». */
  async function expand(root: HTMLElement): Promise<HTMLButtonElement | null> {
    const toggle = root.querySelector<HTMLButtonElement>('button[aria-expanded]');
    toggle?.click();
    await fixture.whenStable();
    return toggle;
  }

  function lastMessage(): unknown {
    return messages.mock.lastCall?.[0];
  }

  const recent = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
  const old = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();

  it('knows the students of a lesson', () => {
    expect(lessonStudents(scheduledLesson())).toEqual(['s-1']);
    expect(lessonStudents(scheduledLesson({ studentId: null }))).toEqual([]);
    expect(lessonStudents(groupLesson())).toEqual(['s-1', 's-2']);
  });

  it('offers to set homework for the lesson in the editor', async () => {
    const root = await show(scheduledLesson({ id: 'l-1' }));
    const chip = root.querySelector('button[aria-label="Добавить домашнее задание"]');
    expect(chip?.textContent.trim()).toBe('ДЗ');
    await add(root, 'Задать');
    expect(navigate).toHaveBeenCalledWith(['/teacher/homework/new'], {
      queryParams: { lessonId: 'l-1' },
    });
  });

  it('offers nothing on a cancelled lesson without homework', async () => {
    const root = await show(scheduledLesson({ status: 'CANCELLED' }));
    expect(root.querySelector('button')).toBeNull();
  });

  it('shows the linked assignments with their status and takes one off', async () => {
    const root = await show(scheduledLesson({ id: 'l-1', assignmentIds: ['a-2', 'a-1', 'gone'] }));
    const toggle = root.querySelector('button[aria-expanded]');
    expect(toggle?.textContent.trim()).toBe('ДЗ: 3\u00A0задания');
    expect(await expand(root)).toBe(toggle);
    expect(toggle?.getAttribute('aria-expanded')).toBe('true');
    expect(root.textContent).toContain('Загрузка');
    backend
      .expectOne(ASSIGNMENTS)
      .flush([
        assignmentSummary({ id: 'a-1', title: 'Дроби' }),
        assignmentSummary({ id: 'a-2', title: 'Черновик', totalTasks: 0, submitted: 0 }),
      ]);
    await fixture.whenStable();
    expect(toggle?.textContent.trim()).toBe('ДЗ: 3\u00A0задания · 1 на проверке');
    const titles = [...root.querySelectorAll('.tb-list__title')].map((title) =>
      title.textContent.trim(),
    );
    expect(titles).toEqual([toggle?.textContent.trim(), 'Черновик', 'Дроби', 'Задание удалено']);
    expect(buttonByText(root, 'Задать')).toBeTruthy();
    expect(root.textContent).toContain('Не выдано');
    expect(root.textContent).toContain('На проверке: 1');
    expect(root.querySelector('a[href="/teacher/homework/a-2/edit"]')).not.toBeNull();
    expect(root.querySelector('a[href="/teacher/homework/a-1"]')).not.toBeNull();

    root
      .querySelector<HTMLButtonElement>('button[aria-label="Действия с заданием «Дроби»"]')
      ?.click();
    await fixture.whenStable();
    menuItemByText('Отвязать').click();
    const request = backend.expectOne({
      method: 'DELETE',
      url: '/api/teacher/schedule/lessons/l-1/homework/a-1',
    });
    const after = scheduledLesson({ id: 'l-1', assignmentIds: ['a-2'] });
    request.flush(after);
    await fixture.whenStable();
    expect(changed).toEqual([after]);
    expect(lastMessage()).toMatchObject({ detail: 'Задание отвязано от урока' });
  });

  it('keeps the assignment when taking it off fails, and keeps it on a cancelled lesson', async () => {
    const root = await show(scheduledLesson({ status: 'CANCELLED', assignmentIds: ['a-1'] }));
    backend.expectOne(ASSIGNMENTS).flush([assignmentSummary()]);
    await fixture.whenStable();
    await expand(root);
    expect(() => buttonByText(root, 'Задать')).toThrow();
    root
      .querySelector<HTMLButtonElement>('button[aria-label="Действия с заданием «Дроби»"]')
      ?.click();
    await fixture.whenStable();
    menuItemByText('Отвязать').click();
    backend
      .expectOne({ method: 'DELETE', url: '/api/teacher/schedule/lessons/l-1/homework/a-1' })
      .flush({}, { status: 500, statusText: 'Server Error' });
    await fixture.whenStable();
    expect(changed).toEqual([]);
    expect(lastMessage()).toMatchObject({ severity: 'error' });
  });

  it('says the assignments were deleted when they cannot be read', async () => {
    const root = await show(scheduledLesson({ assignmentIds: ['a-1'] }));
    backend.expectOne(ASSIGNMENTS).error(new ProgressEvent('offline'));
    await fixture.whenStable();
    await expand(root);
    expect(root.textContent).toContain('Задание удалено');
  });

  it('links a recent assignment of the participants that no lesson has', async () => {
    const root = await show(groupLesson({ id: 'l-1' }));
    await add(root, 'Привязать');
    lessonsRequest().flush([scheduledLesson({ id: 'other', assignmentIds: ['taken'] })]);
    backend
      .expectOne(ASSIGNMENTS)
      .flush([
        assignmentSummary({ id: 'a-1', title: 'Старое', createdAt: old, studentIds: ['s-1'] }),
        assignmentSummary({ id: 'a-2', title: 'Мария', createdAt: recent, studentIds: ['s-2'] }),
        assignmentSummary({ id: 'taken', title: 'Занято', createdAt: recent, studentIds: ['s-1'] }),
        assignmentSummary({ id: 'a-3', title: 'Чужое', createdAt: recent, studentIds: ['s-9'] }),
      ]);
    backend
      .expectOne(BANK)
      .flush([
        assignmentSummary({ id: 'b-2', title: 'Ясное', bank: true }),
        assignmentSummary({ id: 'b-1', title: 'Буквы', bank: true }),
      ]);
    await fixture.whenStable();
    expect(fixture.componentInstance.choices().map((choice) => choice.key)).toEqual([
      'a:a-2',
      'b:b-1',
      'b:b-2',
    ]);

    choose('a:a-2');
    buttonByText(root, 'Привязать').click();
    const request = backend.expectOne({
      method: 'POST',
      url: '/api/teacher/schedule/lessons/l-1/homework',
    });
    expect(request.request.body).toEqual({ assignmentId: 'a-2' });
    const after = groupLesson({ id: 'l-1', assignmentIds: ['a-2'] });
    request.flush(after);
    await fixture.whenStable();
    expect(changed).toEqual([after]);
    expect(lastMessage()).toMatchObject({ detail: 'Задание привязано к уроку' });
    await show(after);
    backend.expectOne(ASSIGNMENTS).flush([assignmentSummary({ id: 'a-2', title: 'Мария' })]);
  });

  it('takes a bank item: its draft for the participants goes on the lesson', async () => {
    const root = await show(scheduledLesson({ id: 'l-1' }));
    await add(root, 'Привязать');
    lessonsRequest().error(new ProgressEvent('offline'));
    backend.expectOne(ASSIGNMENTS).error(new ProgressEvent('offline'));
    backend.expectOne(BANK).flush([assignmentSummary({ id: 'b-1', title: 'Буквы', bank: true })]);
    await fixture.whenStable();
    choose('b:b-1');
    buttonByText(root, 'Привязать').click();
    const use = backend.expectOne({ method: 'POST', url: `${ASSIGNMENTS}/b-1/use` });
    expect(use.request.body).toEqual({ studentIds: ['s-1'] });
    use.flush(assignmentDetails({ id: 'd-1', tasks: [] }));
    const after = scheduledLesson({ id: 'l-1', assignmentIds: ['d-1'] });
    backend
      .expectOne({ method: 'POST', url: '/api/teacher/schedule/lessons/l-1/homework' })
      .flush(after);
    await fixture.whenStable();
    expect(changed).toEqual([after]);
    expect(lastMessage()).toMatchObject({ detail: 'Черновик из шаблона привязан к уроку' });
    await show(after);
    backend.expectOne(ASSIGNMENTS).flush([]);
  });

  it('deletes the draft that could not go on the lesson, and the picker can be closed', async () => {
    const root = await show(scheduledLesson({ id: 'l-1' }));
    await add(root, 'Привязать');
    lessonsRequest().flush([]);
    backend.expectOne(ASSIGNMENTS).flush([]);
    backend.expectOne(BANK).flush([assignmentSummary({ id: 'b-1', bank: true })]);
    await fixture.whenStable();
    choose('b:b-1');
    buttonByText(root, 'Привязать').click();
    backend.expectOne(`${ASSIGNMENTS}/b-1/use`).flush(assignmentDetails({ id: 'd-1', tasks: [] }));
    backend
      .expectOne('/api/teacher/schedule/lessons/l-1/homework')
      .flush(
        { status: 422, code: 'schedule.lesson-cancelled' },
        { status: 422, statusText: 'Unprocessable' },
      );
    backend.expectOne({ method: 'DELETE', url: `${ASSIGNMENTS}/d-1` }).flush(null);
    await fixture.whenStable();
    expect(changed).toEqual([]);
    expect(lastMessage()).toMatchObject({ severity: 'error' });

    expect(fixture.nativeElement).toHaveProperty('className', 'tb-lesson-prep--row');
    buttonByText(root, 'Отмена').click();
    await fixture.whenStable();
    expect(root.querySelector('button[aria-label="Добавить домашнее задание"]')).not.toBeNull();
  });

  it('reports a bank that cannot be read and a link that is refused', async () => {
    const root = await show(scheduledLesson({ id: 'l-1' }));
    await add(root, 'Привязать');
    lessonsRequest().flush([]);
    backend
      .expectOne(ASSIGNMENTS)
      .flush([assignmentSummary({ id: 'a-1', createdAt: recent, studentIds: ['s-1'] })]);
    backend.expectOne(BANK).flush({}, { status: 500, statusText: 'Server Error' });
    await fixture.whenStable();
    expect(lastMessage()).toMatchObject({ severity: 'error' });
    choose('a:a-1');
    buttonByText(root, 'Привязать').click();
    backend
      .expectOne('/api/teacher/schedule/lessons/l-1/homework')
      .flush(
        { status: 409, code: 'schedule.assignment-linked' },
        { status: 409, statusText: 'Conflict' },
      );
    await fixture.whenStable();
    expect(changed).toEqual([]);
    expect(messages).toHaveBeenCalledTimes(2);
  });
});
