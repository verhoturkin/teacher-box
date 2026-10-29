import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ToBoardDialog } from '@features/boards/parts';
import { TextbookToBoardDialog } from '@features/textbooks/parts';
import { FileSaver } from '@shared/files/file-saver';
import {
  assignmentDetails,
  assignmentSummary,
  attachment,
  boundTextbook,
  reviewQueueItem,
  taskDetails,
} from '@testing/homework-fixtures';
import { aiStatus } from '@testing/ai-fixtures';
import {
  aFile,
  bodyText,
  buttonByText,
  hostElement,
  readableText,
  requireElement,
  settleFiles,
} from '@testing/dom';
import { aGroup } from '@testing/identity-fixtures';
import { aBoard } from '@testing/boards-fixtures';
import { AssignMoreDialog } from './assign-more-dialog';
import { BindTextbookDialog } from './bind-textbook-dialog';
import { AssignmentPage } from './assignment-page';
import { AssignmentsPage } from './assignments-page';
import { TaskReviewPage } from './task-review-page';
import { screenWidth, testProviders } from '@testing/setup';
import { RailState } from '@core/layout/rail-state';

const STUDENTS = [
  { id: 's-1', displayName: 'Анна', status: 'ACTIVE' },
  { id: 's-2', displayName: 'Борис', status: 'ACTIVE' },
  { id: 's-3', displayName: 'Вера', status: 'INVITED' },
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

function configure(): { backend: HttpTestingController; saved: string[] } {
  TestBed.configureTestingModule({
    providers: testProviders(),
  });
  const saved: string[] = [];
  vi.spyOn(TestBed.inject(FileSaver), 'save').mockImplementation((_blob, filename) => {
    saved.push(filename);
  });
  vi.spyOn(TestBed.inject(MessageService), 'add');
  return { backend: TestBed.inject(HttpTestingController), saved };
}

const QUEUE = '/api/teacher/homework/review-queue';
const ASSIGNMENTS = '/api/teacher/homework/assignments';

describe('AssignmentsPage', () => {
  // the fixture's due date (10.09) is still ahead; Wednesday 2 September 2026
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-02T12:00:00Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  async function render(assignments = [assignmentSummary()], queue = [reviewQueueItem()]) {
    const { backend } = configure();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(AssignmentsPage);
    await fixture.whenStable();
    backend.expectOne(ASSIGNMENTS).flush(assignments);
    backend.expectOne(QUEUE).flush(queue);
    await fixture.whenStable();
    return { backend, fixture, navigate, host: hostElement(fixture) };
  }

  function rows(host: HTMLElement): string[] {
    return [...host.querySelectorAll('.tb-list > li')].map((row) => readableText(row));
  }

  function segment(host: HTMLElement, label: string): HTMLButtonElement {
    return buttonByText(host, label);
  }

  it('shows the works to review first, then the assignments that wait for hand-in', async () => {
    const { host } = await render(
      [
        assignmentSummary({
          assigned: 1,
          submitted: 0,
          totalTasks: 2,
          accepted: 1,
          dueAt: '2099-01-01T10:00:00Z',
        }),
        assignmentSummary({ id: 'a-late', title: 'Давнее', dueAt: '2020-01-01T10:00:00Z' }),
      ],
      [
        reviewQueueItem({ studentAvatar: '/api/public/avatars/anna' }),
        reviewQueueItem({
          taskId: 't-2',
          studentId: 's-2',
          studentName: 'Борис',
          dueAt: '2026-09-01T10:00:00Z',
        }),
      ],
    );

    const list = rows(host);
    expect(readableText(host)).toContain('На проверку 2');
    expect(segment(host, 'На проверку').getAttribute('aria-pressed')).toBe('true');
    expect(host.querySelector('table')).toBeNull();
    expect(list[0]).toMatch(/^Анна Дроби · сдано 05\.09 \d\d:\d\d$/);
    expect(list[1]).toContain('Борис');
    expect(list[1]).toContain('Просрочено');
    expect(host.querySelectorAll('tb-avatar img')).toHaveLength(1);
    expect(host.querySelectorAll('a[href="/teacher/homework/tasks/t-1"]')).toHaveLength(1);
    expect(readableText(host)).toContain('Ждут сдачи');
    expect(list[2]).toContain('Дроби');
    expect(list[2]).toContain('1 из 2');
    expect(list[3]).toContain('Давнее');
    expect(list[3]).toContain('Просрочено');
  });

  it('lists the active assignments and, under them, the drafts', async () => {
    const { host, fixture } = await render(
      [
        assignmentSummary({ id: 'a-1', title: 'Дроби', dueAt: '2020-09-10T15:00:00Z' }),
        assignmentSummary({
          id: 'a-2',
          title: 'Без срока',
          dueAt: null,
          students: ['А', 'Б', 'В', 'Г', 'Д'],
          totalTasks: 5,
          submitted: 0,
          accepted: 2,
        }),
        assignmentSummary({
          id: 'a-3',
          title: 'Черновик',
          students: [],
          totalTasks: 0,
          submitted: 0,
        }),
        assignmentSummary({ id: 'a-4', title: 'Готово', totalTasks: 2, submitted: 0, accepted: 2 }),
        assignmentSummary({
          id: 'a-5',
          title: 'Свежее',
          // the end of the current year: the row leaves the year out
          dueAt: `${String(new Date().getFullYear())}-12-15T10:00:00Z`,
          students: ['Анна', 'Борис', 'Вера'],
          totalTasks: 1,
          submitted: 0,
        }),
      ],
      [],
    );
    // nothing to review: the list opens on «Активные»
    expect(segment(host, 'Активные').getAttribute('aria-pressed')).toBe('true');
    expect(readableText(host)).toContain('Активные 4');
    expect(readableText(host)).toContain('Готовые 1');
    // grouped by the due date; the overdue ones are folded
    const overdue = buttonByText(host, 'Просрочено: 1');
    expect(overdue.getAttribute('aria-expanded')).toBe('false');
    expect(readableText(host)).not.toContain('Дроби');
    const headings = [...host.querySelectorAll('h2')].map((h) => readableText(h));
    expect(headings).toEqual(['Позже', 'Без срока', 'Не выдано']);
    let list = rows(host);
    expect(list[0]).toMatch(/Свежее Анна и ещё 2 · до 15\.12 \d\d:\d\d /);
    expect(list[0]).toContain('Выдано');
    expect(list[1]).toContain('А и ещё 4 · без срока');
    expect(list[1]).toContain('Принято 2 из 5');
    expect(list[2]).toContain('Ещё никому не выдано');
    expect(readableText(host)).not.toContain('Готово Анна');

    overdue.click();
    await fixture.whenStable();
    expect(overdue.getAttribute('aria-expanded')).toBe('true');
    list = rows(host);
    expect(list[0]).toContain('Дроби Анна, Борис · до 10.09.2020');
    expect(list[0]).toContain('На проверке: 1');

    segment(host, 'Готовые').click();
    await fixture.whenStable();
    expect(rows(host)).toHaveLength(1);
    expect(rows(host)[0]).toContain('Готово');
    expect(rows(host)[0]).toContain('Принято');
  });

  it('always shows search and filters by title or student', async () => {
    const { host, fixture } = await render(
      [assignmentSummary(), assignmentSummary({ id: 'a-2', title: 'Корни', students: ['Вера'] })],
      [],
    );
    expect(host.querySelector('button[aria-label="Поиск"]')).toBeNull();
    const field = requireElement(host, 'input[type="search"]', HTMLInputElement);
    field.value = 'вера';
    field.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(rows(host)).toHaveLength(1);
    expect(rows(host)[0]).toContain('Корни');

    field.value = 'нет такого';
    field.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(readableText(host)).toContain('Ничего не найдено');

    field.value = '';
    field.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(host.querySelector('input[type="search"]')).not.toBeNull();
    expect(rows(host)).toHaveLength(2);
  });

  it('keeps the search in the address and restores it on arrival', async () => {
    const { host, fixture, navigate } = await render(
      [assignmentSummary(), assignmentSummary({ id: 'a-2', title: 'Корни', students: ['Вера'] })],
      [],
    );
    const field = requireElement(host, 'input[type="search"]', HTMLInputElement);
    field.value = ' вера ';
    field.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(navigate).toHaveBeenLastCalledWith(
      [],
      expect.objectContaining({
        queryParams: { q: 'вера' },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      }),
    );
    fixture.destroy();
  });

  it('starts with the search of the address', async () => {
    const { backend } = configure();
    await TestBed.inject(Router).navigateByUrl('/?q=%D0%B2%D0%B5%D1%80%D0%B0');
    const fixture = TestBed.createComponent(AssignmentsPage);
    await fixture.whenStable();
    backend
      .expectOne(ASSIGNMENTS)
      .flush([
        assignmentSummary(),
        assignmentSummary({ id: 'a-2', title: 'Корни', students: ['Вера'] }),
      ]);
    backend.expectOne(QUEUE).flush([]);
    await fixture.whenStable();
    const host = hostElement(fixture);
    expect(requireElement(host, 'input[type="search"]', HTMLInputElement).value).toBe('вера');
    expect(rows(host)).toHaveLength(1);
    expect(rows(host)[0]).toContain('Корни');
    fixture.destroy();
  });

  it('filters by «Кому» from the address: a group, then one student', async () => {
    const { backend } = configure();
    await TestBed.inject(Router).navigateByUrl('/?who=group:group-1');
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(AssignmentsPage);
    await fixture.whenStable();
    backend
      .expectOne(ASSIGNMENTS)
      .flush([
        assignmentSummary({ id: 'a-1', title: 'Дроби', studentIds: ['student-1'] }),
        assignmentSummary({ id: 'a-2', title: 'Корни', studentIds: ['s-9'] }),
        assignmentSummary({ id: 'a-3', title: 'Степени', studentIds: ['s-8', 'student-2'] }),
      ]);
    backend.expectOne(QUEUE).flush([]);
    backend.expectOne('/api/teacher/students').flush([]);
    backend
      .expectOne('/api/teacher/groups')
      .flush([
        aGroup(),
        aGroup({ id: 'group-old', name: 'Архив', archivedAt: '2026-09-01T10:00:00Z' }),
      ]);
    await fixture.whenStable();
    const host = hostElement(fixture);
    // the group: its members' assignments only, in the order of the due date (all «Позже» here)
    expect(rows(host).map((row) => row.split(' ')[0])).toEqual(['Дроби', 'Степени']);

    // another choice goes into the address
    fixture.componentInstance.whom.setValue('student:s-9');
    await fixture.whenStable();
    expect(navigate).toHaveBeenLastCalledWith(
      [],
      expect.objectContaining({ queryParams: { who: 'student:s-9' } }),
    );
    expect(rows(host).map((row) => row.split(' ')[0])).toEqual(['Корни']);

    // «Все» drops the parameter
    fixture.componentInstance.whom.setValue(null);
    await fixture.whenStable();
    expect(navigate).toHaveBeenLastCalledWith(
      [],
      expect.objectContaining({ queryParams: { who: null } }),
    );
    expect(rows(host)).toHaveLength(3);
    fixture.destroy();
  });

  it('shows the finished assignments 20 at a time', async () => {
    const finished = Array.from({ length: 45 }, (_, index) =>
      assignmentSummary({
        id: `a-${String(index)}`,
        title: `Готово ${String(index)}`,
        totalTasks: 1,
        submitted: 0,
        accepted: 1,
      }),
    );
    const { host, fixture } = await render(finished, []);
    segment(host, 'Готовые').click();
    await fixture.whenStable();
    expect(rows(host)).toHaveLength(20);

    buttonByText(host, 'Показать ещё').click();
    await fixture.whenStable();
    expect(rows(host)).toHaveLength(40);
    buttonByText(host, 'Показать ещё').click();
    await fixture.whenStable();
    expect(rows(host)).toHaveLength(45);
    expect(() => buttonByText(host, 'Показать ещё')).toThrow();
  });

  it('says what is empty in each filter', async () => {
    const { host, fixture } = await render(
      [assignmentSummary({ totalTasks: 2, submitted: 0, accepted: 2 })],
      [],
    );
    expect(readableText(host)).toContain('Активных заданий нет');
    segment(host, 'Готовые').click();
    await fixture.whenStable();
    expect(rows(host)).toHaveLength(1);
    segment(host, 'На проверку').click();
    await fixture.whenStable();
    expect(readableText(host)).toContain('Всё проверено');
  });

  it('finds nothing among the works either', async () => {
    const { host, fixture } = await render([], [reviewQueueItem()]);
    const field = requireElement(host, 'input[type="search"]', HTMLInputElement);
    field.value = 'нет такого';
    field.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(readableText(host)).toContain('Ничего не найдено');
  });

  it('opens assignments through their title; the row «⋮» only offers a copy', async () => {
    const { host } = await render([assignmentSummary()], []);
    expect(host.querySelector('a[href="/teacher/homework/a-1"]')).not.toBeNull();
    expect(host.querySelectorAll('.tb-list p-button')).toHaveLength(1);
  });

  it('makes a copy from the row «⋮» and opens its editor', async () => {
    const { host, fixture, backend, navigate } = await render([assignmentSummary()], []);

    requireElement(host, '.tb-list p-button button', HTMLButtonElement).click();
    await fixture.whenStable();
    requireElement(document.body, '.p-menu a.p-menu-item-link', HTMLAnchorElement).click();
    await fixture.whenStable();
    expect(readableText(document.body)).not.toContain('Удалить');
    backend
      .expectOne({ method: 'POST', url: `${ASSIGNMENTS}/a-1/copy` })
      .flush(assignmentDetails({ id: 'a-2', title: 'Дроби (копия)' }));
    await fixture.whenStable();
    backend.expectOne(ASSIGNMENTS).flush([assignmentSummary()]);
    backend.expectOne(QUEUE).flush([]);
    await fixture.whenStable();

    expect(navigate).toHaveBeenCalledWith(['/teacher/homework', 'a-2', 'edit']);
    expect(TestBed.inject(MessageService).add).toHaveBeenCalledWith(
      expect.objectContaining({ detail: 'Создана копия «Дроби (копия)»' }),
    );
    fixture.destroy();
  });

  it('shows a failed load with «Повторить», then the empty state', async () => {
    const { backend } = configure();
    const fixture = TestBed.createComponent(AssignmentsPage);
    await fixture.whenStable();
    backend
      .expectOne('/api/teacher/homework/assignments')
      .flush(null, { status: 500, statusText: 'Error' });
    backend.match(QUEUE);
    await fixture.whenStable();

    expect(readableText(hostElement(fixture))).toContain('Не удалось загрузить задания');

    buttonByText(hostElement(fixture), 'Повторить').click();
    backend.expectOne('/api/teacher/homework/assignments').flush([]);
    backend.expectOne(QUEUE).flush([]);
    await fixture.whenStable();

    expect(readableText(hostElement(fixture))).toContain('Заданий пока нет');
  });

  it('opens the editor of a new assignment from «Создать» (?create=assignment)', async () => {
    const { backend } = configure();
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/?create=assignment');
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(AssignmentsPage);
    await fixture.whenStable();

    // the editor takes the place of the list in the history; the parameter leaves with the list
    expect(navigate).toHaveBeenCalledExactlyOnceWith(['/teacher/homework/new'], {
      replaceUrl: true,
    });
    backend.match('/api/teacher/homework/assignments');
    backend.match(QUEUE);
    fixture.destroy();
  });
});

describe('AssignmentPage', () => {
  async function render(details = assignmentDetails()) {
    const context = configure();
    const fixture = TestBed.createComponent(AssignmentPage);
    fixture.componentRef.setInput('assignmentId', 'a-1');
    await fixture.whenStable();
    context.backend.expectOne('/api/teacher/homework/assignments/a-1').flush(details);
    await fixture.whenStable();
    return { ...context, fixture, host: hostElement(fixture) };
  }

  /** «Добавить» in the «Ученики» header: the dialog loads the students and the groups. */
  async function openAssignMore(
    fixture: Awaited<ReturnType<typeof render>>['fixture'],
    backend: HttpTestingController,
  ): Promise<AssignMoreDialog> {
    // «Добавить» at the top right of the «Ученики» header (not «Добавить файлы»)
    buttonByText(hostElement(fixture).querySelector('.tb-asg__head')!, 'Добавить').click();
    await fixture.whenStable();
    backend.expectOne('/api/teacher/students').flush(STUDENTS);
    await fixture.whenStable();
    backend.expectOne('/api/teacher/groups').flush([aGroup()]);
    await fixture.whenStable();
    return fixture.debugElement
      .query(By.directive(AssignMoreDialog))
      .injector.get(AssignMoreDialog);
  }

  it('links the board the assignment is on with its own icon', async () => {
    const { host } = await render(assignmentDetails({ boardId: 'board-1' }));
    const link = host.querySelector('a[href="/teacher/boards/board-1"]');

    expect(link?.textContent).toContain('Открыть доску');
    expect(link?.querySelector('.tb-i-arrow_outward')).not.toBeNull();
    expect(buttonByText(host, 'На доску').querySelector('.tb-i-co_present')).not.toBeNull();
  });

  it('makes a copy from the header «⋮» and opens its editor', async () => {
    const { fixture, host, backend } = await render();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const changed = vi.fn();
    fixture.componentInstance.changed.subscribe(changed);

    buttonByText(host, 'Действия').click();
    await fixture.whenStable();
    requireElement(document.body, '.p-menu a.p-menu-item-link', HTMLAnchorElement).click();
    await fixture.whenStable();
    backend
      .expectOne({ method: 'POST', url: `${ASSIGNMENTS}/a-1/copy` })
      .flush(assignmentDetails({ id: 'a-2', title: 'Дроби (копия)' }));
    await fixture.whenStable();

    expect(navigate).toHaveBeenCalledWith(['/teacher/homework', 'a-2', 'edit']);
    expect(changed).toHaveBeenCalled();
    fixture.destroy();
  });

  it('deletes the assignment after a confirmation and goes back to the list', async () => {
    const { fixture, host, backend } = await render();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const confirmation = fixture.debugElement.injector.get(ConfirmationService);
    const confirm = vi.spyOn(confirmation, 'confirm').mockImplementation((options) => {
      options.accept?.();
      return confirmation;
    });

    buttonByText(host, 'Удалить…').click();
    expect(confirm.mock.calls[0]?.[0].message).toContain('Задание «Дроби» будет удалено');
    await fixture.whenStable();
    backend
      .expectOne({ method: 'DELETE', url: '/api/teacher/homework/assignments/a-1' })
      .flush(null);
    await fixture.whenStable();

    expect(navigate).toHaveBeenCalledWith(['/teacher/homework']);
    expect(TestBed.inject(MessageService).add).toHaveBeenCalledWith(
      expect.objectContaining({ detail: 'Задание «Дроби» удалено' }),
    );
    fixture.destroy();
  });

  it('shows a failed load with «Повторить» and the way back', async () => {
    const { backend } = configure();
    const fixture = TestBed.createComponent(AssignmentPage);
    fixture.componentRef.setInput('assignmentId', 'a-1');
    await fixture.whenStable();
    backend
      .expectOne('/api/teacher/homework/assignments/a-1')
      .flush(
        { status: 404, code: 'assignment.not-found' },
        { status: 404, statusText: 'Not Found' },
      );
    await fixture.whenStable();
    const host = hostElement(fixture);

    expect(readableText(host)).toContain('Не удалось загрузить задание Задание не найдено');

    buttonByText(host, 'Повторить').click();
    backend.expectOne('/api/teacher/homework/assignments/a-1').flush(assignmentDetails());
    await fixture.whenStable();

    expect(host.querySelector('.tb-markdown strong')?.textContent).toBe('№1-5');
  });

  it('shows the assignment, materials and progress', async () => {
    const { fixture, host, backend, saved } = await render();

    expect(host.querySelector('.tb-markdown strong')?.textContent).toBe('№1-5');
    expect(readableText(host)).toContain('Срок: 10.09.2026');
    expect(host.querySelector('table')).toBeNull();
    const students = [...host.querySelectorAll('ul[aria-label="Ученики"] > li')].map((card) =>
      readableText(card),
    );
    expect(students[0]).toMatch(/^А Анна Сдано 05\.09\.2026 \d\d:\d\d На проверке$/);
    expect(students[1]).toBe('Б Борис Не сдано Выдано Просрочено');
    const reviewLink = host.querySelector('a[href="/teacher/homework/tasks/t-1"]');
    expect(reviewLink?.textContent.trim()).toBe('Анна');
    expect(reviewLink?.getAttribute('aria-label')).toBe('Проверить: Анна');
    expect(
      host.querySelector('a[href="/teacher/homework/tasks/t-2"]')?.getAttribute('aria-label'),
    ).toBe('Открыть: Борис');
    expect(host.querySelector('ul[aria-label="Файлы"] .tb-i-picture_as_pdf')).not.toBeNull();

    buttonByText(host, 'условие.pdf').click();
    backend.expectOne('/api/teacher/homework/attachments/f-1').flush(new Blob(['pdf']));
    expect(saved).toEqual(['условие.pdf']);
    fixture.destroy();
  });

  it('shows the videos and whether the student sees a transcript', async () => {
    const { host, fixture } = await render(
      assignmentDetails({
        videos: [
          {
            url: 'https://youtu.be/dQw4w9WgXcQ',
            provider: 'YOUTUBE' as const,
            videoId: 'dQw4w9WgXcQ',
            startSeconds: null,
            title: 'Present Simple',
            transcript: '[0:05] We play',
            transcriptShown: true,
          },
        ],
      }),
    );

    expect(readableText(host)).toContain('Видео Present Simple');
    expect(readableText(host)).toContain('ученик видит расшифровку');
    expect(host.querySelector('iframe')).not.toBeNull();
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
    Object.defineProperty(picker, 'files', {
      value: [aFile('схема.png')],
      configurable: true,
    });
    picker.dispatchEvent(new Event('change'));
    backend
      .expectOne('/api/me/homework/limits')
      .flush({ maxFileSize: 1024 * 1024, maxFilesPerUpload: 10 });
    await settleFiles();
    await fixture.whenStable();
    buttonByText(host, 'Загрузить').click();
    backend
      .expectOne('/api/teacher/homework/assignments/a-1/attachments')
      .flush([attachment({ id: 'f-3', filename: 'схема.png' })]);
    await fixture.whenStable();
    expect(readableText(host)).toContain('схема.png');

    buttonByText(host, 'Удалить файл условие.pdf').click();
    await fixture.whenStable();
    backend
      .expectOne({ method: 'DELETE', url: '/api/teacher/homework/assignments/a-1/attachments/f-1' })
      .flush(null);
    await fixture.whenStable();
    expect(readableText(host)).not.toContain('условие.pdf');
    fixture.destroy();
  });

  it('gives the assignment to more students in a dialog', async () => {
    const { fixture, backend } = await render();
    const dialog = await openAssignMore(fixture, backend);

    dialog.members.setValue([{ kind: 'STUDENT', id: 's-3' }]);
    await fixture.whenStable();
    buttonByText(document.body, 'Выдать').click();
    const request = backend.expectOne('/api/teacher/homework/assignments/a-1/students');
    expect(request.request.body).toEqual({ studentIds: ['s-3'] });
    request.flush(assignmentDetails());
    await fixture.whenStable();

    expect(dialog.visible()).toBe(false);
    expect(TestBed.inject(MessageService).add).toHaveBeenCalledWith(
      expect.objectContaining({ detail: 'Задание выдано' }),
    );
    fixture.destroy();
  });

  it('closes the dialog when nobody is chosen', async () => {
    const { fixture, backend } = await render();
    const dialog = await openAssignMore(fixture, backend);

    dialog.assign();

    expect(dialog.visible()).toBe(false);
    backend.expectNone('/api/teacher/homework/assignments/a-1/students');
    fixture.destroy();
  });

  it('does not reassign students who already have the assignment', async () => {
    const { fixture, backend } = await render();
    const dialog = await openAssignMore(fixture, backend);
    dialog.members.setValue([
      { kind: 'STUDENT', id: 's-1' },
      { kind: 'STUDENT', id: 's-3' },
    ]);
    await fixture.whenStable();
    dialog.assign();
    const request = backend.expectOne('/api/teacher/homework/assignments/a-1/students');
    expect(request.request.body).toEqual({ studentIds: ['s-3'] });
    request.flush(assignmentDetails());
    fixture.destroy();
  });

  it('binds, changes and unbinds textbooks', async () => {
    const { fixture, host, backend } = await render();
    const dialog = fixture.debugElement
      .query(By.directive(BindTextbookDialog))
      .injector.get(BindTextbookDialog);

    buttonByText(host, 'Привязать учебник').click();
    await fixture.whenStable();
    expect(dialog.visible()).toBe(true);
    expect(dialog.bound()).toBeNull();
    backend.expectOne('/api/teacher/textbooks').flush([]);
    dialog.saved.emit(
      assignmentDetails({
        textbooks: [
          boundTextbook(),
          boundTextbook({ textbookId: 'tb-2', title: 'Тетрадь', pages: null }),
        ],
      }),
    );
    await fixture.whenStable();
    expect(readableText(host)).toContain('Учебник · Английский · с. 12-14');
    expect(readableText(host)).toContain('целиком');

    host.querySelector<HTMLButtonElement>('button[aria-label="Страницы: Spotlight 5"]')?.click();
    await fixture.whenStable();
    expect(dialog.bound()?.textbookId).toBe('tb-1');

    host.querySelector<HTMLButtonElement>('button[aria-label="На доску: Spotlight 5"]')?.click();
    await fixture.whenStable();
    const board = fixture.debugElement
      .query(By.directive(TextbookToBoardDialog))
      .injector.get(TextbookToBoardDialog);
    expect(board.visible()).toBe(true);
    expect(board.textbook()).toEqual({
      id: 'tb-1',
      title: 'Spotlight 5',
      format: 'PDF',
      pageCount: 120,
    });
    expect(board.initialPages()).toBe('12-14');
    expect(board.students()).toEqual(['s-1', 's-2']);
    backend.expectOne('/api/teacher/boards?studentId=s-1&studentId=s-2').flush([]);
    board.visible.set(false);
    await fixture.whenStable();

    host
      .querySelector<HTMLButtonElement>('button[aria-label="Убрать из задания: Тетрадь"]')
      ?.click();
    backend
      .expectOne({ method: 'DELETE', url: '/api/teacher/homework/assignments/a-1/textbooks/tb-2' })
      .flush(assignmentDetails({ textbooks: [boundTextbook()] }));
    await fixture.whenStable();
    expect(readableText(host)).not.toContain('Тетрадь');
    fixture.destroy();
  });

  it('puts the assignment with its textbook pages on a board and remembers the board', async () => {
    const assignment = assignmentDetails({
      description: null,
      attachments: [],
      textbooks: [boundTextbook({ pages: '12-13' })],
    });
    const { fixture, host, backend } = await render(assignment);

    buttonByText(host, 'На доску').click();
    await fixture.whenStable();
    backend.expectOne((request) => request.url === '/api/teacher/boards').flush([]);
    await fixture.whenStable();

    // The page's own dialog: the textbook's dialog has another one.
    const board = fixture.debugElement
      .queryAll(By.directive(ToBoardDialog))
      .at(-1)!
      .injector.get(ToBoardDialog);
    expect(board.visible()).toBe(true);
    expect(board.title()).toBe(assignment.title);
    expect(board.students()).toEqual(assignment.tasks.map((task) => task.studentId));
    expect(board.pictures()).toEqual([
      '/api/teacher/textbooks/tb-1/pages/12',
      '/api/teacher/textbooks/tb-1/pages/13',
    ]);

    board.placed.emit({ mode: 'text', board: aBoard(), href: '/teacher/boards/board-1' });
    const placed = backend.expectOne({
      method: 'PUT',
      url: '/api/teacher/homework/assignments/a-1/board',
    });
    expect(placed.request.body).toEqual({ boardId: 'board-1' });
    placed.flush({ ...assignment, boardId: 'board-1' });
    await fixture.whenStable();
    expect(host.querySelector('a[href="/teacher/boards/board-1"]')).not.toBeNull();
    fixture.destroy();
  });

  it('has nothing to put on a board without a text, pictures or pages', async () => {
    const { fixture, host } = await render(
      assignmentDetails({ description: null, attachments: [], textbooks: [] }),
    );

    expect(buttonByText(host, 'На доску').disabled).toBe(true);
    fixture.destroy();
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

  it('shows a failed load with «Повторить»', async () => {
    const { backend } = configure();
    const fixture = TestBed.createComponent(TaskReviewPage);
    fixture.componentRef.setInput('taskId', 't-1');
    backend.expectOne('/api/teacher/ai/status').flush(aiStatus({ enabled: false }));
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
    expect(TestBed.inject(MessageService).add).toHaveBeenCalledWith(
      expect.objectContaining({ detail: 'Работа принята' }),
    );
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
      taskDetails({
        status: 'RETURNED',
        teacherComment: 'Исправь №3',
        reviewedAt: '2026-09-06T10:00:00Z',
      }),
    );

    expect(readableText(host)).toContain('Ваш комментарий Исправь №3');
    buttonByText(host, 'решение.jpg').click();
    backend.expectOne('/api/teacher/homework/attachments/f-2').flush(new Blob(['jpg']));
    expect(saved).toEqual(['решение.jpg']);
  });

  it('keeps the form after a failed review', async () => {
    const { host, backend } = await render();

    buttonByText(host, 'Принять').click();
    backend
      .expectOne('/api/teacher/homework/tasks/t-1/review')
      .flush(null, { status: 500, statusText: 'Error' });

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

    expect(fixture.componentInstance.form.getRawValue()).toEqual({
      grade: '4',
      comment: 'Почти верно, проверь №2',
    });
    expect(readableText(host)).toContain('ИИ предлагает вернуть работу на доработку');
  });

  it('puts the review on a board', async () => {
    const details = taskDetails();
    const { fixture, host, backend } = await render(details);
    const toBoard = buttonByText(host, 'На доску');
    expect(toBoard.disabled).toBe(true);

    fixture.componentInstance.form.setValue({ grade: '', comment: 'Проверь №2' });
    await fixture.whenStable();
    const board = fixture.debugElement
      .query(By.directive(ToBoardDialog))
      .injector.get(ToBoardDialog);
    expect(board.markdown()).toBe('Проверь №2');
    fixture.componentInstance.form.setValue({ grade: '4', comment: 'Проверь №2' });
    await fixture.whenStable();
    toBoard.click();
    await fixture.whenStable();
    backend.expectOne((request) => request.url === '/api/teacher/boards').flush([]);
    await fixture.whenStable();

    expect(board.visible()).toBe(true);
    expect(board.title()).toBe('Разбор: ' + details.assignment.title);
    expect(board.markdown()).toBe('**Оценка: 4**\n\nПроверь №2');
    expect(board.students()).toEqual([details.studentId]);
  });

  it('suggests accepting and tolerates a missing grade', async () => {
    const { fixture, host, backend } = await render(taskDetails(), true);

    buttonByText(host, 'Черновик проверки').click();
    backend
      .expectOne('/api/teacher/ai/review-draft')
      .flush({ comment: 'Отлично', grade: null, accept: true });
    await fixture.whenStable();

    expect(fixture.componentInstance.form.controls.grade.value).toBe('');
    expect(readableText(host)).toContain('ИИ предлагает принять работу');
  });

  it('keeps the form when the AI draft fails', async () => {
    const { fixture, host, backend } = await render(taskDetails(), true);

    buttonByText(host, 'Черновик проверки').click();
    backend
      .expectOne('/api/teacher/ai/review-draft')
      .flush(null, { status: 422, statusText: 'Unprocessable' });
    await fixture.whenStable();

    expect(fixture.componentInstance.form.controls.comment.value).toBe('');
    expect(buttonByText(host, 'Черновик проверки')).toBeDefined();
  });

  it('offers no AI draft without a text answer or when AI is off', async () => {
    const withoutText = taskDetails();
    const filesOnly = {
      ...withoutText,
      submissions: withoutText.submissions.map((s) => ({ ...s, text: null })),
    };
    const { host } = await render(filesOnly, true);
    expect(bodyText()).not.toContain('Черновик проверки');
    expect(host.textContent).toContain('Принять');
  });

  it('hides the AI draft when AI is off', async () => {
    const { host } = await render(taskDetails(), false);

    expect(host.textContent).not.toContain('Черновик проверки');
  });
});

describe('TaskReviewPage as a detail pane', () => {
  async function render(single: boolean, details = taskDetails()) {
    const context = configure();
    const fixture = TestBed.createComponent(TaskReviewPage);
    fixture.componentRef.setInput('taskId', 't-1');
    fixture.componentRef.setInput('single', single);
    context.backend.expectOne('/api/teacher/ai/status').flush(aiStatus({ enabled: false }));
    await fixture.whenStable();
    context.backend.expectOne('/api/teacher/homework/tasks/t-1').flush(details);
    await fixture.whenStable();
    return { ...context, fixture, host: hostElement(fixture) };
  }

  it('titles the work with the assignment and the line «student · due · status · attempt»', async () => {
    const { host } = await render(false);

    expect(host.querySelector('h1')?.textContent).toBe('Дроби');
    expect(readableText(host.querySelector('.tb-task__meta')!)).toMatch(
      /^Анна · срок 10\.09\.2026 \d\d:\d\d .*попытка 1$/,
    );
    expect(host.querySelector('.tb-page-header__back')).toBeNull();
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

describe('AssignmentsPage with a detail', () => {
  async function render(input: 'taskId' | 'assignmentId', id: string) {
    const { backend } = configure();
    const fixture = TestBed.createComponent(AssignmentsPage);
    fixture.componentRef.setInput(input, id);
    await fixture.whenStable();
    backend.expectOne(ASSIGNMENTS).flush([assignmentSummary()]);
    backend.expectOne(QUEUE).flush([reviewQueueItem()]);
    await fixture.whenStable();
    return { backend, fixture, host: hostElement(fixture) };
  }

  it('opens the work beside the list and marks its row', async () => {
    const { backend, fixture, host } = await render('taskId', 't-1');
    backend.expectOne('/api/teacher/ai/status').flush(aiStatus({ enabled: false }));
    backend.expectOne('/api/teacher/homework/tasks/t-1').flush(taskDetails());
    await fixture.whenStable();

    expect(host.querySelector('tb-task-review-page')).not.toBeNull();
    expect(host.querySelector('.tb-list__item--current')).not.toBeNull();
    expect(
      host.querySelector('a[href="/teacher/homework/tasks/t-1"]')?.getAttribute('aria-current'),
    ).toBe('page');
  });

  it('opens the assignment beside the list and marks its row', async () => {
    const { backend, fixture, host } = await render('assignmentId', 'a-1');
    backend.expectOne('/api/teacher/homework/assignments/a-1').flush(assignmentDetails());
    await fixture.whenStable();

    expect(host.querySelector('tb-assignment-page')).not.toBeNull();
    expect(host.querySelector('tb-pane:last-child .tb-pane__header h1')?.textContent).toBe('Дроби');
  });

  it('reads the lists again after a work is reviewed', async () => {
    const { backend, fixture, host } = await render('taskId', 't-1');
    backend.expectOne('/api/teacher/ai/status').flush(aiStatus({ enabled: false }));
    backend.expectOne('/api/teacher/homework/tasks/t-1').flush(taskDetails());
    await fixture.whenStable();

    buttonByText(host, 'Принять').click();
    backend
      .expectOne('/api/teacher/homework/tasks/t-1/review')
      .flush(taskDetails({ status: 'ACCEPTED' }));
    backend.expectOne(ASSIGNMENTS).flush([assignmentSummary()]);
    backend.expectOne(QUEUE).flush([]);
    await fixture.whenStable();

    expect(readableText(host)).toContain('На проверку 0');
  });
});

describe('AssignmentsPage with the review side sheet (extra-large)', () => {
  const QUEUE_OF_THREE = [
    reviewQueueItem(),
    reviewQueueItem({ taskId: 't-2', studentId: 's-2', studentName: 'Борис' }),
    reviewQueueItem({ taskId: 't-3', studentId: 's-3', studentName: 'Вера' }),
  ];

  async function render(queue = QUEUE_OF_THREE, aiEnabled = false) {
    TestBed.configureTestingModule({ providers: testProviders(screenWidth(1700)) });
    vi.spyOn(TestBed.inject(MessageService), 'add');
    const backend = TestBed.inject(HttpTestingController);
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(AssignmentsPage);
    fixture.componentRef.setInput('taskId', 't-1');
    await fixture.whenStable();
    backend.expectOne(ASSIGNMENTS).flush([assignmentSummary()]);
    backend.expectOne(QUEUE).flush(queue);
    backend.expectOne('/api/teacher/ai/status').flush(aiStatus({ enabled: aiEnabled }));
    backend.expectOne('/api/teacher/homework/tasks/t-1').flush(taskDetails());
    await fixture.whenStable();
    return { backend, fixture, host: hostElement(fixture), navigate };
  }

  it('takes the review out of the work into a third pane and collapses the rail', async () => {
    const { fixture, host } = await render();

    expect(host.querySelector('tb-review-sheet')).not.toBeNull();
    expect(host.querySelector('tb-task-review-page form')).toBeNull();
    expect(readableText(host)).toContain('1 из 3');
    expect(TestBed.inject(RailState).collapsed()).toBe(true);
    fixture.destroy();
    expect(TestBed.inject(RailState).collapsed()).toBe(false);
  });

  it('names the next work and opens it', async () => {
    const { host, navigate, fixture } = await render();

    buttonByText(host, 'Дальше: Борис').click();
    await fixture.whenStable();

    expect(navigate).toHaveBeenCalledWith(['/teacher/homework/tasks', 't-2']);
  });

  it('closes the review back to the list', async () => {
    const { host, navigate } = await render();

    requireElement(
      host,
      '.tb-pane__header button[aria-label="Закрыть проверку"]',
      HTMLElement,
    ).click();

    expect(navigate).toHaveBeenCalledWith(['/teacher/homework']);
  });

  it('takes the quick phrases into the comment', async () => {
    const { host, fixture } = await render();

    buttonByText(host, 'Отлично').click();
    buttonByText(host, 'Есть ошибка').click();
    await fixture.whenStable();

    expect(requireElement(host, '#sheet-comment', HTMLTextAreaElement).value).toBe(
      'Отлично!\nЕсть ошибка: ',
    );
  });

  it('accepts the work and opens the next one of the queue', async () => {
    const { backend, host, navigate, fixture } = await render();

    buttonByText(host, 'Принять').click();
    backend
      .expectOne('/api/teacher/homework/tasks/t-1/review')
      .flush(taskDetails({ status: 'ACCEPTED' }));
    backend.expectOne(ASSIGNMENTS).flush([assignmentSummary()]);
    backend.expectOne(QUEUE).flush(QUEUE_OF_THREE.slice(1));
    await fixture.whenStable();

    expect(navigate).toHaveBeenCalledWith(['/teacher/homework/tasks', 't-2']);
  });

  it('returns the work for rework and goes back to the list when it was the last one', async () => {
    const { backend, host, navigate, fixture } = await render([reviewQueueItem()]);

    expect(host.querySelector('.tb-sheet__next')).toBeNull();
    buttonByText(host, 'На доработку').click();
    backend
      .expectOne('/api/teacher/homework/tasks/t-1/review')
      .flush(taskDetails({ status: 'RETURNED' }));
    backend.expectOne(ASSIGNMENTS).flush([assignmentSummary()]);
    backend.expectOne(QUEUE).flush([]);
    await fixture.whenStable();

    expect(navigate).toHaveBeenCalledWith(['/teacher/homework']);
  });

  it('keeps the sheet on a failed decision', async () => {
    const { backend, host, navigate, fixture } = await render();

    buttonByText(host, 'Принять').click();
    backend
      .expectOne('/api/teacher/homework/tasks/t-1/review')
      .flush({ title: 'x' }, { status: 500, statusText: 'Server Error' });
    await fixture.whenStable();

    expect(navigate).not.toHaveBeenCalled();
    expect(host.querySelector('tb-review-sheet')).not.toBeNull();
  });

  it('shows the AI draft in its own block and «Вставить» takes it', async () => {
    const { backend, host, fixture } = await render(QUEUE_OF_THREE, true);

    buttonByText(host, 'Черновик ИИ').click();
    backend
      .expectOne('/api/teacher/ai/review-draft')
      .flush({ comment: 'Почти верно', grade: '4', accept: true });
    await fixture.whenStable();

    expect(readableText(host)).toContain('ИИ предлагает принять работу');
    buttonByText(host, 'Вставить').click();
    await fixture.whenStable();
    expect(requireElement(host, '#sheet-comment', HTMLTextAreaElement).value).toBe('Почти верно');
    expect(requireElement(host, '#sheet-grade', HTMLInputElement).value).toBe('4');
  });

  it('keeps the form when the AI draft fails', async () => {
    const { backend, host, fixture } = await render(QUEUE_OF_THREE, true);

    buttonByText(host, 'Черновик ИИ').click();
    backend
      .expectOne('/api/teacher/ai/review-draft')
      .flush({ title: 'x' }, { status: 500, statusText: 'Server Error' });
    await fixture.whenStable();

    expect(host.querySelector('.tb-sheet__draft')).toBeNull();
    expect(buttonByText(host, 'Черновик ИИ')).not.toBeNull();
  });

  it('puts the review on a board', async () => {
    const { host, fixture } = await render();

    buttonByText(host, 'Отлично').click();
    await fixture.whenStable();
    buttonByText(host, 'На доску').click();
    await fixture.whenStable();

    expect(fixture.debugElement.query(By.directive(ToBoardDialog))).not.toBeNull();
  });
});

describe('AssignmentsPage with the review on a phone (compact)', () => {
  async function render(aiEnabled = false) {
    TestBed.configureTestingModule({ providers: testProviders(screenWidth(390)) });
    vi.spyOn(TestBed.inject(MessageService), 'add');
    const backend = TestBed.inject(HttpTestingController);
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(AssignmentsPage);
    fixture.componentRef.setInput('taskId', 't-1');
    await fixture.whenStable();
    backend.expectOne(ASSIGNMENTS).flush([assignmentSummary()]);
    backend
      .expectOne(QUEUE)
      .flush([
        reviewQueueItem(),
        reviewQueueItem({ taskId: 't-2', studentId: 's-2', studentName: 'Борис' }),
      ]);
    backend.expectOne('/api/teacher/ai/status').flush(aiStatus({ enabled: aiEnabled }));
    backend.expectOne('/api/teacher/homework/tasks/t-1').flush(taskDetails());
    await fixture.whenStable();
    return { backend, fixture, host: hostElement(fixture), navigate };
  }

  const toolbarButton = (host: HTMLElement, label: string): HTMLElement =>
    requireElement(host, `.tb-toolbar [aria-label="${label}"]`, HTMLElement);

  it('shows the floating toolbar, no form and no bottom bar', async () => {
    const { fixture, host } = await render();

    expect(requireElement(host, '.tb-toolbar', HTMLElement).getAttribute('role')).toBe('toolbar');
    expect(host.querySelector('tb-task-review-page form')).toBeNull();
    expect(host.querySelector('.tb-sheet__head')).toBeNull();
    expect(TestBed.inject(RailState).bottomBarHidden()).toBe(true);
    fixture.destroy();
    expect(TestBed.inject(RailState).bottomBarHidden()).toBe(false);
  });

  it('takes the comment in a bottom sheet and accepts with it', async () => {
    const { backend, fixture, host } = await render();

    toolbarButton(host, 'Комментарий ученику').click();
    await fixture.whenStable();
    const comment = requireElement(document.body, '#sheet-comment', HTMLTextAreaElement);
    comment.value = 'Хорошо';
    comment.dispatchEvent(new Event('input'));
    buttonByText(document.body, 'Готово').click();
    buttonByText(host, 'Принять').click();

    const request = backend.expectOne('/api/teacher/homework/tasks/t-1/review');
    expect(request.request.body).toMatchObject({ decision: 'ACCEPT', comment: 'Хорошо' });
    request.flush(taskDetails({ status: 'ACCEPTED' }));
    backend.expectOne(ASSIGNMENTS).flush([assignmentSummary()]);
    backend.expectOne(QUEUE).flush([]);
    await fixture.whenStable();
  });

  it('returns the work for rework from the toolbar', async () => {
    const { backend, fixture, host } = await render();

    buttonByText(host, 'На доработку').click();
    backend
      .expectOne('/api/teacher/homework/tasks/t-1/review')
      .flush(taskDetails({ status: 'RETURNED' }));
    backend.expectOne(ASSIGNMENTS).flush([assignmentSummary()]);
    backend.expectOne(QUEUE).flush([]);
    await fixture.whenStable();
  });

  it('opens the sheet with the draft of the AI', async () => {
    const { backend, fixture, host } = await render(true);

    toolbarButton(host, 'Черновик ИИ').click();
    backend
      .expectOne('/api/teacher/ai/review-draft')
      .flush({ comment: 'Почти верно', grade: '4', accept: true });
    await fixture.whenStable();

    expect(readableText(document.body)).toContain('ИИ предлагает принять работу');
    buttonByText(document.body, 'Вставить').click();
    await fixture.whenStable();
    expect(requireElement(document.body, '#sheet-comment', HTMLTextAreaElement).value).toBe(
      'Почти верно',
    );
    toolbarButton(host, 'Черновик ИИ').click();
  });

  it('opens the sheet when the grade is wrong', async () => {
    const { fixture, host } = await render();

    toolbarButton(host, 'Комментарий ученику').click();
    await fixture.whenStable();
    const grade = requireElement(document.body, '#sheet-grade', HTMLInputElement);
    grade.value = 'x'.repeat(21);
    grade.dispatchEvent(new Event('input'));
    buttonByText(document.body, 'Готово').click();
    await fixture.whenStable();
    buttonByText(host, 'Принять').click();
    await fixture.whenStable();

    expect(document.body.querySelector('#sheet-grade')).not.toBeNull();
  });
});
