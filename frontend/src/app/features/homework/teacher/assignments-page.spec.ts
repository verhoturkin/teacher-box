import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import {
  ASSIGNMENTS_URL,
  HOMEWORK_STUDENTS,
  REVIEW_QUEUE_URL,
  assignmentDetails,
  assignmentSummary,
  configureHomework,
  reviewQueueItem,
  taskDetails,
} from '@testing/homework-fixtures';
import { aiStatus } from '@testing/ai-fixtures';
import { buttonByText, hostElement, readableText, requireElement } from '@testing/dom';
import { aGroup, aStudent, aTag } from '@testing/identity-fixtures';
import { AssignmentsPage } from './assignments-page';
import { screenWidth, testProviders } from '@testing/setup';
import { RailState } from '@core/layout/rail-state';

describe('AssignmentsPage', () => {
  // the fixture's due date (10.09) is still ahead; Wednesday 2 September 2026
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-02T12:00:00Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  async function render(
    assignments = [assignmentSummary()],
    queue = [reviewQueueItem()],
    width = 1200,
  ) {
    TestBed.configureTestingModule({ providers: testProviders(screenWidth(width)) });
    vi.spyOn(TestBed.inject(MessageService), 'add');
    const backend = TestBed.inject(HttpTestingController);
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(AssignmentsPage);
    await fixture.whenStable();
    backend.expectOne(ASSIGNMENTS_URL).flush(assignments);
    backend.expectOne(REVIEW_QUEUE_URL).flush(queue);
    await fixture.whenStable();
    return { backend, fixture, navigate, host: hostElement(fixture) };
  }

  /** The lines of the table: group headings and assignments. */
  function rows(host: HTMLElement): string[] {
    return [...host.querySelectorAll('tbody tr')].map((row) => readableText(row));
  }

  /** The titles of the assignments in the table, in order. */
  function titles(host: HTMLElement): string[] {
    return [...host.querySelectorAll('tbody tr:not(.tb-hw__group-row) a.tb-list__title')].map(
      (link) => readableText(link),
    );
  }

  function segment(host: HTMLElement, label: string): HTMLButtonElement {
    return buttonByText(host, label);
  }

  const GROUPED = [
    assignmentSummary({
      id: 'a-over',
      title: 'Давнее',
      dueAt: '2026-09-01T10:00:00Z',
      students: ['Илья'],
      totalTasks: 2,
      assigned: 1,
      submitted: 0,
      accepted: 1,
    }),
    assignmentSummary({
      id: 'a-week',
      title: 'Дроби',
      dueAt: '2026-09-04T10:00:00Z',
      textbooks: 1,
      files: 2,
      questions: 5,
      boardId: 'b-1',
    }),
    assignmentSummary({
      id: 'a-later',
      title: 'Корни',
      dueAt: '2026-09-20T10:00:00Z',
      students: ['А', 'Б', 'В'],
      totalTasks: 3,
      assigned: 3,
      submitted: 0,
    }),
    assignmentSummary({ id: 'a-none', title: 'Без срока', dueAt: null }),
    assignmentSummary({
      id: 'a-draft',
      title: 'Черновик',
      students: [],
      totalTasks: 0,
      assigned: 0,
      submitted: 0,
    }),
    assignmentSummary({
      id: 'a-done',
      title: 'Готово',
      totalTasks: 2,
      assigned: 0,
      submitted: 0,
      accepted: 2,
    }),
  ];

  describe('the review strip', () => {
    const WORKS = [
      reviewQueueItem({ submittedAt: '2026-09-02T09:12:00Z', quizScore: 8, quizMax: 10 }),
      reviewQueueItem({
        taskId: 't-2',
        studentId: 's-2',
        studentName: 'Борис',
        submittedAt: '2026-09-01T09:12:00Z',
        dueAt: '2026-09-01T07:00:00Z',
        studentAvatar: '/api/public/avatars/boris',
      }),
      reviewQueueItem({ taskId: 't-3', studentId: 's-3', studentName: 'Вера' }),
      reviewQueueItem({ taskId: 't-4', studentId: 's-4', studentName: 'Гена' }),
    ];

    it('shows the latest works as cards and says how many wait for review', async () => {
      const { host } = await render(GROUPED, WORKS);

      expect(readableText(host)).toContain('Ждут проверки · 4');
      const cards = [...host.querySelectorAll('.tb-hw__card:not(.tb-hw__card--waiting)')].map(
        (card) => readableText(card),
      );
      expect(cards).toHaveLength(3);
      expect(cards[0]).toMatch(/Анна сдано сегодня, \d\d:\d\d Дроби Тест 8 из 10 Проверить$/);
      expect(cards[1]).toMatch(/Борис сдано вчера, \d\d:\d\d С опозданием Дроби Проверить$/);
      expect(cards[2]).toMatch(/Вера сдано 05\.09 \d\d:\d\d Дроби Проверить$/);
      expect(host.querySelectorAll('.tb-hw__card tb-avatar img')).toHaveLength(1);
    });

    it('counts the works somebody still has to hand in in a dashed card', async () => {
      const { host } = await render(GROUPED, WORKS);

      // Дроби 1 + Давнее 1 + Корни 3 + Без срока 1 + Готово/черновик 0
      expect(readableText(requireElement(host, '.tb-hw__card--waiting', HTMLElement))).toBe(
        'Ещё 6 работ ждут сдачи',
      );
    });

    it('opens a work from its card and the whole queue from the first work', async () => {
      const { host, navigate } = await render(GROUPED, WORKS);

      requireElement(host, 'button[aria-label="Проверить: Борис, Дроби"]', HTMLElement).click();
      expect(navigate).toHaveBeenLastCalledWith(['/teacher/homework/tasks', 't-2']);

      buttonByText(host, 'Проверить все подряд').click();
      expect(navigate).toHaveBeenLastCalledWith(['/teacher/homework/tasks', 't-1']);
    });

    it('is left out when nothing waits for review', async () => {
      const { host } = await render(GROUPED, []);

      expect(host.querySelector('.tb-hw__review')).toBeNull();
      expect(readableText(host)).not.toContain('Ждут проверки');
    });

    it('follows the search and «Кому» like the table', async () => {
      const { host, fixture } = await render(GROUPED, WORKS);
      const field = requireElement(host, 'input[type="search"]', HTMLInputElement);
      field.value = 'гена';
      field.dispatchEvent(new Event('input'));
      await fixture.whenStable();

      expect(readableText(host)).toContain('Ждут проверки · 1');
      expect(host.querySelectorAll('.tb-hw__card:not(.tb-hw__card--waiting)')).toHaveLength(1);
    });
  });

  describe('the table', () => {
    it('groups the active assignments by the due date', async () => {
      const { host } = await render(GROUPED, []);

      expect(host.querySelectorAll('.tb-pane')).toHaveLength(1);
      expect(host.querySelector('tb-assignment-page')).toBeNull();
      expect([...host.querySelectorAll('thead th')].map((header) => readableText(header))).toEqual([
        'Задание',
        'Кому',
        'Срок',
        'Сдали',
        'Статус',
        'Действия',
      ]);
      const lines = rows(host);
      expect(lines.filter((line) => /·\s\d$/.test(line))).toEqual([
        'Просрочено · 1',
        'На этой неделе · 1',
        'Позже · 1',
        'Без срока · 1',
      ]);
      expect(titles(host)).toEqual(['Давнее', 'Дроби', 'Корни', 'Без срока']);
      expect(host.querySelector('tr.tb-hw__group-row h2.tb-error')?.textContent).toContain(
        'Просрочено',
      );
    });

    it('shows the materials, the students, the due date, the progress and the status', async () => {
      const { host } = await render(GROUPED, []);
      const row = (title: string): HTMLElement =>
        requireElement(host, `tbody tr:has(a[href="/teacher/homework/${title}"])`, HTMLElement);

      const week = row('a-week');
      expect(
        [...week.querySelectorAll('.tb-hw__material')].map((icon) =>
          icon.getAttribute('aria-label'),
        ),
      ).toEqual(['Учебники: 1', 'Файлы: 2', 'Вопросы: 5', 'Доска']);
      expect(readableText(week)).toContain('Анна, Борис');
      expect(readableText(week)).toMatch(/04\.09 \d\d:\d\d/);
      expect(week.querySelector('.tb-error')).toBeNull();
      expect(week.querySelector('.tb-hw__bar')?.getAttribute('aria-label')).toBe('1 из 2');
      expect(readableText(week)).toContain('На проверке: 1');
      expect(week.querySelector('.tb-i-co_present')).not.toBeNull();

      const overdue = row('a-over');
      expect(overdue.querySelector('td:nth-child(3)')?.classList).toContain('tb-error');
      expect(readableText(overdue)).toContain('Принято 1 из 2');
      expect(overdue.querySelector('.tb-hw__material')).toBeNull();

      expect(readableText(row('a-later'))).toContain('А и ещё 2');
      expect(readableText(row('a-none'))).toContain('Без срока');
    });

    it('is the only pane: the list stays out of the way of a detail', async () => {
      const { host } = await render(GROUPED, []);

      expect(host.querySelectorAll('tb-pane')).toHaveLength(1);
      expect(host.querySelector('tb-task-review-page')).toBeNull();
      expect(host.querySelector('tb-assignment-page')).toBeNull();
    });

    it('opens an assignment through its title', async () => {
      const { host } = await render([assignmentSummary()], []);

      expect(host.querySelector('a[href="/teacher/homework/a-1"]')).not.toBeNull();
      expect(host.querySelectorAll('tbody p-button')).toHaveLength(1);
    });
  });

  describe('the toolbar', () => {
    it('counts the assignments of each filter and switches between them', async () => {
      const { host, fixture } = await render(GROUPED, []);

      expect(readableText(host)).toContain('Активные 4');
      expect(readableText(host)).toContain('Черновики 1');
      expect(readableText(host)).toContain('Готовые 1');
      expect(segment(host, 'Активные').getAttribute('aria-pressed')).toBe('true');

      segment(host, 'Черновики').click();
      await fixture.whenStable();
      expect(titles(host)).toEqual(['Черновик']);
      expect(host.querySelector('tr.tb-hw__group-row')).toBeNull();
      expect(readableText(host)).toContain('Ещё никому не выдано');

      segment(host, 'Готовые').click();
      await fixture.whenStable();
      expect(titles(host)).toEqual(['Готово']);
      expect(readableText(host)).toContain('2 из 2');
    });

    it('searches by title and by student', async () => {
      const { host, fixture } = await render(
        [assignmentSummary(), assignmentSummary({ id: 'a-2', title: 'Корни', students: ['Вера'] })],
        [],
      );
      const field = requireElement(host, 'input[type="search"]', HTMLInputElement);
      field.value = 'вера';
      field.dispatchEvent(new Event('input'));
      await fixture.whenStable();
      expect(titles(host)).toEqual(['Корни']);

      field.value = 'дроб';
      field.dispatchEvent(new Event('input'));
      await fixture.whenStable();
      expect(titles(host)).toEqual(['Дроби']);

      field.value = 'нет такого';
      field.dispatchEvent(new Event('input'));
      await fixture.whenStable();
      expect(readableText(host)).toContain('Ничего не найдено');

      field.value = '';
      field.dispatchEvent(new Event('input'));
      await fixture.whenStable();
      expect(titles(host)).toHaveLength(2);
    });

    it('keeps the search in the address', async () => {
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
      const { backend } = configureHomework();
      await TestBed.inject(Router).navigateByUrl('/?q=%D0%B2%D0%B5%D1%80%D0%B0');
      const fixture = TestBed.createComponent(AssignmentsPage);
      await fixture.whenStable();
      backend
        .expectOne(ASSIGNMENTS_URL)
        .flush([
          assignmentSummary(),
          assignmentSummary({ id: 'a-2', title: 'Корни', students: ['Вера'] }),
        ]);
      backend.expectOne(REVIEW_QUEUE_URL).flush([]);
      await fixture.whenStable();
      const host = hostElement(fixture);
      expect(requireElement(host, 'input[type="search"]', HTMLInputElement).value).toBe('вера');
      expect(titles(host)).toEqual(['Корни']);
      fixture.destroy();
    });

    it('filters by «Кому» from the address: a group, then one student', async () => {
      const { backend } = configureHomework();
      await TestBed.inject(Router).navigateByUrl('/?who=group:group-1');
      const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
      const fixture = TestBed.createComponent(AssignmentsPage);
      await fixture.whenStable();
      backend
        .expectOne(ASSIGNMENTS_URL)
        .flush([
          assignmentSummary({ id: 'a-1', title: 'Дроби', studentIds: ['student-1'] }),
          assignmentSummary({ id: 'a-2', title: 'Корни', studentIds: ['s-9'] }),
          assignmentSummary({ id: 'a-3', title: 'Степени', studentIds: ['s-8', 'student-2'] }),
        ]);
      backend.expectOne(REVIEW_QUEUE_URL).flush([]);
      backend.expectOne('/api/teacher/students').flush([]);
      backend
        .expectOne('/api/teacher/groups')
        .flush([
          aGroup(),
          aGroup({ id: 'group-old', name: 'Архив', archivedAt: '2026-09-01T10:00:00Z' }),
        ]);
      await fixture.whenStable();
      const host = hostElement(fixture);
      // the group: its members' assignments only
      expect(titles(host)).toEqual(['Дроби', 'Степени']);

      // another choice goes into the address
      fixture.componentInstance.whom.setValue('student:s-9');
      await fixture.whenStable();
      expect(navigate).toHaveBeenLastCalledWith(
        [],
        expect.objectContaining({ queryParams: { who: 'student:s-9' } }),
      );
      expect(titles(host)).toEqual(['Корни']);

      // «Все» drops the parameter
      fixture.componentInstance.whom.setValue(null);
      await fixture.whenStable();
      expect(navigate).toHaveBeenLastCalledWith(
        [],
        expect.objectContaining({ queryParams: { who: null } }),
      );
      expect(titles(host)).toHaveLength(3);
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
      expect(titles(host)).toHaveLength(20);

      buttonByText(host, 'Показать ещё').click();
      await fixture.whenStable();
      expect(titles(host)).toHaveLength(40);
      buttonByText(host, 'Показать ещё').click();
      await fixture.whenStable();
      expect(titles(host)).toHaveLength(45);
      expect(() => buttonByText(host, 'Показать ещё')).toThrow();
    });

    it('says what is empty in each filter', async () => {
      const { host, fixture } = await render(
        [assignmentSummary({ totalTasks: 2, submitted: 0, accepted: 2 })],
        [],
      );
      expect(readableText(host)).toContain('Активных заданий нет');
      segment(host, 'Черновики').click();
      await fixture.whenStable();
      expect(readableText(host)).toContain('Черновиков нет');
      segment(host, 'Готовые').click();
      await fixture.whenStable();
      expect(titles(host)).toHaveLength(1);
    });

    it('says there is no homework yet', async () => {
      const { host } = await render([], []);
      expect(readableText(host)).toContain('Заданий пока нет');
    });

    it('says nothing is finished yet', async () => {
      const { host, fixture } = await render([assignmentSummary()], []);
      segment(host, 'Готовые').click();
      await fixture.whenStable();
      expect(readableText(host)).toContain('Выполненных заданий пока нет');
    });
  });

  it('makes a copy from the row «⋮» and opens its editor', async () => {
    const { host, fixture, backend, navigate } = await render([assignmentSummary()], []);

    requireElement(host, 'tbody p-button button', HTMLButtonElement).click();
    await fixture.whenStable();
    requireElement(document.body, '.p-menu a.p-menu-item-link', HTMLAnchorElement).click();
    await fixture.whenStable();
    expect(readableText(document.body)).not.toContain('Удалить');
    backend
      .expectOne({ method: 'POST', url: `${ASSIGNMENTS_URL}/a-1/copy` })
      .flush(assignmentDetails({ id: 'a-2', title: 'Дроби (копия)' }));
    await fixture.whenStable();
    backend.expectOne(ASSIGNMENTS_URL).flush([assignmentSummary()]);
    backend.expectOne(REVIEW_QUEUE_URL).flush([]);
    await fixture.whenStable();

    expect(navigate).toHaveBeenCalledWith(['/teacher/homework', 'a-2', 'edit']);
    expect(TestBed.inject(MessageService).add).toHaveBeenCalledWith(
      expect.objectContaining({ detail: 'Создана копия «Дроби (копия)»' }),
    );
    fixture.destroy();
  });

  it('opens the editor of a new assignment from «Новое задание»', async () => {
    const { host, fixture, navigate } = await render([], []);

    buttonByText(host, 'Новое задание').click();
    await fixture.whenStable();

    expect(navigate).toHaveBeenCalledWith(['/teacher/homework/new'], { replaceUrl: false });
    fixture.destroy();
  });

  it('shows a failed load with «Повторить», then the empty state', async () => {
    const { backend } = configureHomework();
    const fixture = TestBed.createComponent(AssignmentsPage);
    await fixture.whenStable();
    backend
      .expectOne('/api/teacher/homework/assignments')
      .flush(null, { status: 500, statusText: 'Error' });
    backend.match(REVIEW_QUEUE_URL);
    await fixture.whenStable();

    expect(readableText(hostElement(fixture))).toContain('Не удалось загрузить задания');

    buttonByText(hostElement(fixture), 'Повторить').click();
    backend.expectOne('/api/teacher/homework/assignments').flush([]);
    backend.expectOne(REVIEW_QUEUE_URL).flush([]);
    await fixture.whenStable();

    expect(readableText(hostElement(fixture))).toContain('Заданий пока нет');
  });

  it('opens the editor from «Создать» (?create=assignment) in place of the address', async () => {
    const { backend } = configureHomework();
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/?create=assignment');
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(AssignmentsPage);
    await fixture.whenStable();

    expect(navigate).toHaveBeenCalledWith(['/teacher/homework/new'], { replaceUrl: true });
    backend.match(() => true);
    fixture.destroy();
  });

  describe('on medium', () => {
    const WORKS = [
      reviewQueueItem(),
      reviewQueueItem({ taskId: 't-2', studentId: 's-2', studentName: 'Борис' }),
      reviewQueueItem({ taskId: 't-3', studentId: 's-3', studentName: 'Вера' }),
    ];

    it('shows tiles with the bar and two cards of the review strip', async () => {
      const { host } = await render(GROUPED, WORKS, 700);

      expect(host.querySelector('table')).toBeNull();
      expect(host.querySelectorAll('.tb-hw__card:not(.tb-hw__card--waiting)')).toHaveLength(2);
      const tiles = [...host.querySelectorAll('.tb-list > li')].map((row) => readableText(row));
      expect(tiles[0]).toContain('Давнее');
      expect(tiles[0]).toContain('1 из 2');
      expect(host.querySelector('.tb-list > li .tb-hw__bar')).not.toBeNull();
      expect(host.querySelector('.tb-list > li .tb-list__lead')).not.toBeNull();
    });
  });

  describe('on a phone (compact)', () => {
    const WORKS = [
      reviewQueueItem(),
      reviewQueueItem({ taskId: 't-2', studentId: 's-2', studentName: 'Борис' }),
    ];

    it('has filter chips and cards instead of the segments and the table', async () => {
      const { host, fixture } = await render(GROUPED, WORKS, 390);

      expect(host.querySelector('table')).toBeNull();
      expect(host.querySelector('.tb-hw__toolbar tb-segment-group')).toBeNull();
      expect(host.querySelector('tb-filter-chips')).not.toBeNull();
      expect(readableText(host)).toContain('Активные 4');
      expect(host.querySelector('p-button.tb-page-fab')?.textContent).toContain('Новое');
      expect(readableText(host)).not.toContain('Новое задание');

      const headings = [...host.querySelectorAll('h2.tb-hw__group')].map((h) => readableText(h));
      expect(headings).toEqual([
        'Просрочено · 1',
        'На этой неделе · 1',
        'Позже · 1',
        'Без срока · 1',
      ]);
      const cards = [...host.querySelectorAll('.tb-list > li')].map((row) => readableText(row));
      expect(cards[0]).toContain('Давнее');
      expect(cards[0]).toMatch(/Илья · до 01\.09 \d\d:\d\d/);
      expect(cards[0]).toContain('1 из 2');
      expect(cards[1]).toContain('На проверке: 1');

      buttonByText(host, 'Черновики').click();
      await fixture.whenStable();
      expect(host.querySelectorAll('.tb-list > li')).toHaveLength(1);
    });

    it('has «Кому» as a chip with a menu in the row of the filter chips', async () => {
      const { backend, host, fixture } = await render(GROUPED, WORKS, 390);
      backend.expectOne('/api/teacher/students').flush(HOMEWORK_STUDENTS);
      backend.expectOne('/api/teacher/groups').flush([aGroup()]);
      await fixture.whenStable();

      expect(host.querySelector('p-select')).toBeNull();
      expect(host.querySelector('tb-filter-chips .tb-filter-chip--menu')).not.toBeNull();
      buttonByText(host, 'Кому: все').click();
      await fixture.whenStable();
      const menu = readableText(requireElement(document.body, '.p-menu', HTMLElement));
      expect(menu).toContain('Все');
      expect(menu).toContain('ОГЭ 9 класс');
      expect(menu).toContain('Вера');

      const vera = [
        ...document.body.querySelectorAll<HTMLElement>('.p-menu a.p-menu-item-link'),
      ].find((item) => readableText(item) === 'Вера');
      vera?.click();
      await fixture.whenStable();
      expect(readableText(host)).toContain('Кому: Вера');
      expect(host.querySelector('.tb-filter-chip--menu.tb-filter-chip--selected')).not.toBeNull();
      expect(titles(host)).toEqual([]);
    });

    it('puts the view switch into the top app bar as one icon button', async () => {
      const { host, fixture } = await render(GROUPED, WORKS, 390);
      const rail = TestBed.inject(RailState);

      expect(host.querySelector('.tb-hw__views')).toBeNull();
      expect(host.querySelector('tb-filter-chips.tb-filter-chips--scroll')).not.toBeNull();
      const [action] = rail.compactBar()?.actions ?? [];
      expect(action?.icon).toBe('grid_view');
      expect(action?.label).toBe('Вид: по ученикам');

      action?.command();
      await fixture.whenStable();
      expect(rail.compactBar()?.actions[0]?.icon).toBe('view_list');
      expect(rail.compactBar()?.actions[0]?.label).toBe('Вид: списком');
    });

    it('scrolls the review strip sideways', async () => {
      const { host } = await render(GROUPED, WORKS, 390);

      const strip = requireElement(host, '.tb-hw__cards', HTMLElement);
      expect(strip.querySelectorAll('.tb-hw__card')).toHaveLength(3);
      expect(readableText(host)).toContain('Ждут проверки · 2');
    });
  });
});

describe('AssignmentsPage with a detail (a page of its own)', () => {
  async function render(input: 'taskId' | 'assignmentId', id: string) {
    const { backend } = configureHomework();
    const fixture = TestBed.createComponent(AssignmentsPage);
    fixture.componentRef.setInput(input, id);
    await fixture.whenStable();
    backend.expectOne(ASSIGNMENTS_URL).flush([assignmentSummary()]);
    backend.expectOne(REVIEW_QUEUE_URL).flush([reviewQueueItem()]);
    await fixture.whenStable();
    return { backend, fixture, host: hostElement(fixture) };
  }

  it('opens the work on its own page, without the list', async () => {
    const { backend, fixture, host } = await render('taskId', 't-1');
    backend.expectOne('/api/teacher/homework/tasks/t-1').flush(taskDetails());
    await fixture.whenStable();

    expect(host.querySelector('tb-task-review-page')).not.toBeNull();
    expect(host.querySelector('table, tb-search-field, tb-segment-group')).toBeNull();
    expect(host.querySelector('a[aria-label="Назад"], .tb-page-header__back')).not.toBeNull();
  });

  it('opens the assignment on its own page with «back» to the list', async () => {
    const { backend, fixture, host } = await render('assignmentId', 'a-1');
    backend.expectOne('/api/teacher/homework/assignments/a-1').flush(assignmentDetails());
    await fixture.whenStable();

    expect(host.querySelector('tb-assignment-page')).not.toBeNull();
    expect(host.querySelector('table, tb-search-field, tb-segment-group')).toBeNull();
    expect(host.querySelector('tb-pane .tb-pane__header h1')?.textContent).toBe('Дроби');
    expect(host.querySelector('.tb-page-header__back')?.getAttribute('href')).toBe(
      '/teacher/homework',
    );
  });

  it('reads the lists again after a work is reviewed and leaves the finished queue', async () => {
    const { backend, fixture, host } = await render('taskId', 't-1');
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    backend.expectOne('/api/teacher/homework/tasks/t-1').flush(taskDetails());
    await fixture.whenStable();
    backend.match('/api/teacher/ai/status').forEach((request) => {
      request.flush(aiStatus({ enabled: false }));
    });

    buttonByText(host, 'Принять').click();
    backend
      .expectOne('/api/teacher/homework/tasks/t-1/review')
      .flush(taskDetails({ status: 'ACCEPTED' }));
    backend.expectOne(ASSIGNMENTS_URL).flush([assignmentSummary()]);
    backend.expectOne(REVIEW_QUEUE_URL).flush([]);
    await fixture.whenStable();

    // both lists were read again (expectOne above); the work was the last of the queue
    expect(host.querySelector('tb-task-review-page')).not.toBeNull();
    expect(navigate).toHaveBeenCalledWith(['/teacher/homework']);
  });
});

describe('AssignmentsPage with the review side sheet (from large)', () => {
  const QUEUE_OF_THREE = [
    reviewQueueItem(),
    reviewQueueItem({ taskId: 't-2', studentId: 's-2', studentName: 'Борис' }),
    reviewQueueItem({ taskId: 't-3', studentId: 's-3', studentName: 'Вера' }),
  ];

  async function render(queue = QUEUE_OF_THREE, aiEnabled = false) {
    TestBed.configureTestingModule({ providers: testProviders(screenWidth(1440)) });
    vi.spyOn(TestBed.inject(MessageService), 'add');
    const backend = TestBed.inject(HttpTestingController);
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(AssignmentsPage);
    fixture.componentRef.setInput('taskId', 't-1');
    await fixture.whenStable();
    backend.expectOne(ASSIGNMENTS_URL).flush([assignmentSummary()]);
    backend.expectOne(REVIEW_QUEUE_URL).flush(queue);
    backend.expectOne('/api/teacher/homework/tasks/t-1').flush(taskDetails());
    await fixture.whenStable();
    backend.expectOne('/api/teacher/ai/status').flush(aiStatus({ enabled: aiEnabled }));
    await fixture.whenStable();
    return { backend, fixture, host: hostElement(fixture), navigate };
  }

  it('takes the review out of the work into a third pane and collapses the rail', async () => {
    const { fixture, host } = await render();

    expect(host.querySelector('tb-review-sheet')).not.toBeNull();
    expect(host.querySelector('tb-task-review-page form')).toBeNull();
    expect(readableText(host)).toContain('1 из 3 на проверке');
    expect(TestBed.inject(RailState).collapsed()).toBe(true);
    fixture.destroy();
    expect(TestBed.inject(RailState).collapsed()).toBe(false);
  });

  it('names the next work and opens it from the header', async () => {
    const { host, navigate, fixture } = await render();

    expect(readableText(host)).toContain('После этого откроется: Борис');
    expect(
      requireElement(host, 'button[aria-label="Предыдущая работа"]', HTMLButtonElement).disabled,
    ).toBe(true);
    requireElement(host, 'button[aria-label="Следующая работа"]', HTMLButtonElement).click();
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

    buttonByText(host, 'Молодец!').click();
    buttonByText(host, 'Аккуратнее с орфографией').click();
    await fixture.whenStable();

    expect(requireElement(host, '#sheet-comment', HTMLTextAreaElement).value).toBe(
      'Молодец!\nАккуратнее с орфографией.',
    );
  });

  it('accepts the work and opens the next one of the queue', async () => {
    const { backend, host, navigate, fixture } = await render();

    buttonByText(host, 'Принять').click();
    backend
      .expectOne('/api/teacher/homework/tasks/t-1/review')
      .flush(taskDetails({ status: 'ACCEPTED' }));
    backend.expectOne(ASSIGNMENTS_URL).flush([assignmentSummary()]);
    backend.expectOne(REVIEW_QUEUE_URL).flush(QUEUE_OF_THREE.slice(1));
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
    backend.expectOne(ASSIGNMENTS_URL).flush([assignmentSummary()]);
    backend.expectOne(REVIEW_QUEUE_URL).flush([]);
    await fixture.whenStable();

    expect(navigate).toHaveBeenCalledWith(['/teacher/homework']);
    expect(TestBed.inject(MessageService).add).toHaveBeenCalledWith(
      expect.objectContaining({ detail: 'Все работы проверены' }),
    );
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
    backend.expectOne('/api/teacher/tags').flush([aTag()]);
    // the page and the AI context both read the students
    for (const students of backend.match('/api/teacher/students')) {
      students.flush([aStudent({ id: 's-1', tags: { 'tag-1': 'v-2' } })]);
    }
    await fixture.whenStable();
    expect(readableText(host)).toContain('Уровень: A2');

    buttonByText(host, 'Черновик ИИ').click();
    const request = backend.expectOne('/api/teacher/ai/review-draft');
    expect(request.request.body).toMatchObject({ context: [{ name: 'Уровень', value: 'A2' }] });
    request.flush({ comment: 'Почти верно', grade: '4', accept: true });
    await fixture.whenStable();

    expect(readableText(host)).toContain('ИИ предлагает принять работу');
    buttonByText(host, 'Вставить').click();
    await fixture.whenStable();
    expect(requireElement(host, '#sheet-comment', HTMLTextAreaElement).value).toBe('Почти верно');
    expect(requireElement(host, '.tb-filter-chip--selected', HTMLElement).textContent.trim()).toBe(
      '4',
    );
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

  it('has no «На доску» under the decision of the inline sheet', async () => {
    const { host } = await render();

    expect(host.textContent).not.toContain('На доску');
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
    backend.expectOne(ASSIGNMENTS_URL).flush([assignmentSummary()]);
    backend
      .expectOne(REVIEW_QUEUE_URL)
      .flush([
        reviewQueueItem(),
        reviewQueueItem({ taskId: 't-2', studentId: 's-2', studentName: 'Борис' }),
      ]);
    backend.expectOne('/api/teacher/homework/tasks/t-1').flush(taskDetails());
    await fixture.whenStable();
    backend.expectOne('/api/teacher/ai/status').flush(aiStatus({ enabled: aiEnabled }));
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
    backend.expectOne(ASSIGNMENTS_URL).flush([assignmentSummary()]);
    backend.expectOne(REVIEW_QUEUE_URL).flush([]);
    await fixture.whenStable();
  });

  it('returns the work for rework from the toolbar', async () => {
    const { backend, fixture, host } = await render();

    buttonByText(host, 'Доработать').click();
    backend
      .expectOne('/api/teacher/homework/tasks/t-1/review')
      .flush(taskDetails({ status: 'RETURNED' }));
    backend.expectOne(ASSIGNMENTS_URL).flush([assignmentSummary()]);
    backend.expectOne(REVIEW_QUEUE_URL).flush([]);
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

  it('opens the sheet when the comment is too long', async () => {
    const { fixture, host } = await render();

    toolbarButton(host, 'Комментарий ученику').click();
    await fixture.whenStable();
    const comment = requireElement(document.body, '#sheet-comment', HTMLTextAreaElement);
    comment.value = 'x'.repeat(5001);
    comment.dispatchEvent(new Event('input'));
    buttonByText(document.body, 'Готово').click();
    await fixture.whenStable();
    buttonByText(host, 'Принять').click();
    await fixture.whenStable();

    expect(document.body.querySelector('#sheet-comment')).not.toBeNull();
  });
});
