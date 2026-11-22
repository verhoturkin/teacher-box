import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { aBoard, aLinkBoard } from '@testing/boards-fixtures';
import { bodyText, buttonByText, hostElement, menuItemByText, typeInto } from '@testing/dom';
import { aGroup, aStudent } from '@testing/identity-fixtures';
import { ConfirmHost, screenWidth, testProviders } from '@testing/setup';
import { assignmentSummary } from '@testing/homework-fixtures';
import { aCourse, aPlanSummary, aTextbook, aWorkbook } from '@testing/textbooks-fixtures';
import type { AssignmentSummary } from '@features/homework/parts';
import { Course, LessonPlanSummary } from '@features/textbooks/parts';
import { MaterialsPage } from './materials-page';

const BANK = '/api/teacher/homework/assignments?bank=true';

function bankItem(overrides: Partial<AssignmentSummary> = {}): AssignmentSummary {
  return assignmentSummary({
    bank: true,
    dueAt: null,
    students: [],
    studentIds: [],
    totalTasks: 0,
    assigned: 0,
    submitted: 0,
    ...overrides,
  });
}

describe('MaterialsPage', () => {
  let fixture: ComponentFixture<MaterialsPage>;
  let backend: HttpTestingController;
  let host: HTMLElement;

  async function render(
    inputs: { tab?: string; q?: string; course?: string } = {},
    width = 1280,
    courses: Course[] = [],
    plans: LessonPlanSummary[] = [
      aPlanSummary(),
      aPlanSummary({ id: 'p-2', title: 'Past Simple', courseId: null, uses: 0 }),
    ],
    bank: AssignmentSummary[] = [
      bankItem({ id: 'b-1', title: 'Дроби', courseId: 'c-1', uses: 2 }),
      bankItem({ id: 'b-2', title: 'Глаголы', createdAt: '2026-09-02T10:00:00Z' }),
    ],
  ): Promise<void> {
    TestBed.configureTestingModule({
      imports: [MaterialsPage],
      providers: testProviders(screenWidth(width)),
    });
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(MaterialsPage);
    for (const [name, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(name, value);
    }
    fixture.detectChanges();
    backend
      .expectOne('/api/teacher/students')
      .flush([
        aStudent({ id: 's-1', displayName: 'Мария' }),
        aStudent({ id: 'gone', status: 'DEACTIVATED' }),
      ]);
    backend.expectOne('/api/teacher/textbooks/courses').flush(courses);
    backend
      .expectOne('/api/teacher/groups')
      .flush([
        aGroup({ id: 'g-1', name: 'ОГЭ' }),
        aGroup({ id: 'old', archivedAt: '2026-01-01T00:00:00Z' }),
      ]);
    backend.expectOne('/api/teacher/boards').flush([aBoard(), aLinkBoard()]);
    backend
      .expectOne('/api/teacher/textbooks')
      .flush([aTextbook({ hasCover: false }), aWorkbook({ hasCover: false })]);
    backend.expectOne('/api/teacher/textbooks/plans?bank=true').flush(plans);
    backend.expectOne(BANK).flush(bank);
    await fixture.whenStable();
    host = hostElement(fixture);
  }

  afterEach(() => {
    backend.verify();
    fixture.destroy();
  });

  it('starts with the search text of `?q=`', async () => {
    await render({ q: 'Мария' });
    expect(host.querySelector<HTMLInputElement>('input[type="search"], input')?.value).toBe(
      'Мария',
    );
  });

  function segments(): string[] {
    return [...host.querySelectorAll('.tb-segment')].map((segment) =>
      segment.textContent.replace(/\s+/g, ' ').trim(),
    );
  }

  function chips(): string[] {
    return [...host.querySelectorAll('.tb-materials__bar .tb-filter-chip')].map((chip) =>
      chip.textContent.trim(),
    );
  }

  function chip(label: string): HTMLButtonElement {
    const found = [...host.querySelectorAll<HTMLButtonElement>('.tb-filter-chip')].find((item) =>
      item.textContent.includes(label),
    );
    if (found === undefined) throw new Error(`No chip ${label}`);
    return found;
  }

  function shownTitles(tab: 'boards' | 'textbooks' | 'lesson-plans' | 'homework-bank'): string[] {
    const feed = host.querySelector(`tb-${tab}-feed`);
    return [...(feed?.querySelectorAll('.tb-material-card__title') ?? [])].map((link) =>
      link.textContent.trim(),
    );
  }

  it('shows boards by default with the numbers of both kinds in the connected group', async () => {
    await render();

    expect(segments()).toEqual(['Доски2', 'Учебники2', 'Планы2', 'Задания2']);
    expect(chips()).toEqual(['Все', 'На портале', 'Внешние']);
    expect(host.querySelector('[hidden] tb-boards-feed')).toBeNull();
    expect(host.querySelector('[hidden] tb-textbooks-feed')).not.toBeNull();
    expect(shownTitles('boards')).toHaveLength(2);
  });

  it('shows textbooks on ?tab=textbooks with the chips of their kinds', async () => {
    await render({ tab: 'textbooks' });

    expect(host.querySelector('[hidden] tb-boards-feed')).not.toBeNull();
    expect(host.querySelector('[hidden] tb-textbooks-feed')).toBeNull();
    expect(chips()).toEqual(['Все', 'Учебники', 'Рабочие тетради', 'Другое']);
    chip('Рабочие тетради').click();
    await fixture.whenStable();
    expect(shownTitles('textbooks')).toEqual(['Рабочая тетрадь']);
  });

  describe('course filter', () => {
    const courses = [
      aCourse({ id: 'c-1', name: 'Английский' }),
      aCourse({ id: 'c-2', name: 'ОГЭ' }),
    ];
    const courseChips = (): string[] =>
      [
        ...host.querySelectorAll(
          '.tb-materials__courses .tb-filter-chip:not(.tb-filter-chip--more)',
        ),
      ].map((item) => item.textContent.trim());

    it('filters the textbooks by `?course=` and puts the chosen course into the address', async () => {
      await render({ tab: 'textbooks', course: 'c-1' }, 1280, courses);
      expect(courseChips()).toEqual(['Все', 'Английский', 'ОГЭ', 'Без курса']);
      expect(shownTitles('textbooks')).toEqual(['Spotlight 5']);

      const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
      chip('Без курса').click();
      expect(navigate).toHaveBeenLastCalledWith([], {
        queryParams: { course: 'none' },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
      fixture.componentRef.setInput('course', 'none');
      await fixture.whenStable();
      expect(shownTitles('textbooks')).toEqual(['Рабочая тетрадь']);

      [
        ...host.querySelectorAll<HTMLButtonElement>('.tb-materials__courses .tb-filter-chip'),
      ][0]?.click();
      expect(navigate).toHaveBeenLastCalledWith([], {
        queryParams: { course: null },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
    });

    it('ignores a course that is gone and has no course row on boards', async () => {
      await render({ course: 'gone' }, 1280, courses);
      expect(host.querySelector('.tb-materials__courses')).toBeNull();
      fixture.componentRef.setInput('tab', 'textbooks');
      await fixture.whenStable();
      expect(shownTitles('textbooks')).toHaveLength(2);
    });

    it('opens «Курсы» from «⋮» and reads the textbooks again after it closes', async () => {
      await render({ tab: 'textbooks' }, 1280, courses);
      host.querySelector<HTMLButtonElement>('button[aria-label="Действия с курсами"]')?.click();
      await fixture.whenStable();
      menuItemByText('Курсы').click();
      await fixture.whenStable();
      expect(bodyText()).toContain('Курс — программа');
      buttonByText(document.body, 'Закрыть').click();
      await fixture.whenStable();
      backend.expectOne('/api/teacher/textbooks').flush([aTextbook({ hasCover: false })]);
      backend.expectOne('/api/teacher/textbooks/plans?bank=true').flush([]);
      backend.expectOne(BANK).flush([]);
      await fixture.whenStable();
      expect(shownTitles('textbooks')).toEqual(['Spotlight 5']);
    });

    it('offers «Курсы» as a button while there are none', async () => {
      await render({ tab: 'textbooks' });
      expect(courseChips()).toEqual([]);
      buttonByText(host, 'Курсы').click();
      await fixture.whenStable();
      expect(bodyText()).toContain('Курсов пока нет.');
    });
  });

  it('puts the tab into the address', async () => {
    await render();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    buttonByText(host, 'Учебники2').click();

    expect(navigate).toHaveBeenCalledWith([], {
      queryParams: { tab: 'textbooks' },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  });

  it('filters the boards by chip and by the one search field, and sorts them', async () => {
    await render();
    chip('Внешние').click();
    await fixture.whenStable();
    expect(shownTitles('boards')).toEqual(['Холст']);
    chip('Все').click();

    const search = host.querySelector<HTMLInputElement>('input[type="search"]');
    if (search === null) throw new Error('No search');
    typeInto(search, 'алгебра');
    await fixture.whenStable();
    expect(shownTitles('boards')).toEqual(['Алгебра']);
    // the textbooks feed hears the same search
    expect(shownTitles('textbooks')).toEqual([]);
    typeInto(search, '');
    await fixture.whenStable();

    buttonByText(host, 'Сначала изменённые').click();
    await fixture.whenStable();
    menuItemByText('По названию').click();
    await fixture.whenStable();
    expect(shownTitles('boards')).toEqual(['Алгебра', 'Холст']);
    expect(host.textContent).toContain('По названию');
  });

  it('opens the form of a new board or textbook from «Создать»', async () => {
    await render();
    const router = TestBed.inject(Router);

    await router.navigateByUrl('/?create=textbook');
    await fixture.whenStable();
    expect(bodyText()).toContain('Новый учебник');
    expect(bodyText()).not.toContain('Новая доска');
  });

  it('opens the form of a new board from «Создать»', async () => {
    await render();
    await TestBed.inject(Router).navigateByUrl('/?create=board');
    await fixture.whenStable();
    expect(bodyText()).toContain('Новая доска');
  });

  it('on a phone has the group on top and the FAB of the open tab', async () => {
    await render({}, 500);
    expect(host.querySelectorAll('.tb-segment')).toHaveLength(4);
    expect(host.querySelectorAll('tb-segment-group')).toHaveLength(1);

    const fab = host.querySelector<HTMLElement>('.tb-page-fab button');
    expect(fab?.textContent).toContain('Новая доска');
    fab?.click();
    await fixture.whenStable();
    expect(document.querySelectorAll('.p-dialog')).toHaveLength(1);
    expect(bodyText()).toContain('Новая доска');

    fixture.componentRef.setInput('tab', 'textbooks');
    await fixture.whenStable();
    expect(host.querySelector('.tb-page-fab button')?.textContent).toContain('Новый учебник');

    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    fixture.componentRef.setInput('tab', 'plans');
    await fixture.whenStable();
    host.querySelector<HTMLElement>('.tb-page-fab button')?.click();
    expect(navigate).toHaveBeenCalledWith(['/teacher/materials/plans/new']);
  });

  describe('plans', () => {
    const courses = [aCourse({ id: 'c-1', name: 'Английский' })];

    it('shows the bank on ?tab=plans with the course and the uses, filtered by course and search', async () => {
      await render({ tab: 'plans' }, 1280, courses);
      expect(host.querySelector('[hidden] tb-lesson-plans-feed')).toBeNull();
      expect(chips()).toEqual([]);
      expect(shownTitles('lesson-plans')).toEqual(['Present Simple', 'Past Simple']);
      expect(host.textContent).toContain('Английский · Использовано 3 раза');
      expect(host.textContent).toContain('Без курса · Ещё не использовался');

      fixture.componentRef.setInput('course', 'none');
      await fixture.whenStable();
      expect(shownTitles('lesson-plans')).toEqual(['Past Simple']);
      fixture.componentRef.setInput('course', 'c-1');
      await fixture.whenStable();
      expect(shownTitles('lesson-plans')).toEqual(['Present Simple']);
      fixture.componentRef.setInput('course', undefined);

      const search = host.querySelector<HTMLInputElement>('input[type="search"]');
      if (search === null) throw new Error('No search');
      typeInto(search, 'англ');
      await fixture.whenStable();
      expect(shownTitles('lesson-plans')).toEqual(['Present Simple']);
      typeInto(search, '');
      await fixture.whenStable();

      buttonByText(host, 'Сначала изменённые').click();
      await fixture.whenStable();
      expect(bodyText()).not.toContain('Сначала новые');
      menuItemByText('По названию').click();
      await fixture.whenStable();
      expect(shownTitles('lesson-plans')).toEqual(['Past Simple', 'Present Simple']);
    });

    it('creates a plan with «Новый план», edits and deletes one from «⋮»', async () => {
      await render({ tab: 'plans' });
      TestBed.createComponent(ConfirmHost).detectChanges();
      const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
      buttonByText(host, 'Новый план').click();
      expect(navigate).toHaveBeenCalledWith(['/teacher/materials/plans/new']);

      host
        .querySelector<HTMLButtonElement>('button[aria-label="Действия: Present Simple"]')
        ?.click();
      await fixture.whenStable();
      menuItemByText('Изменить').click();
      expect(navigate).toHaveBeenLastCalledWith(['/teacher/materials/plans', 'p-1']);

      host.querySelector<HTMLButtonElement>('button[aria-label="Действия: Past Simple"]')?.click();
      await fixture.whenStable();
      menuItemByText('Удалить…').click();
      await fixture.whenStable();
      expect(bodyText()).toContain('Планы уроков, сделанные из него, останутся');
      buttonByText(document.body, 'Удалить').click();
      await fixture.whenStable();
      backend.expectOne({ method: 'DELETE', url: '/api/teacher/textbooks/plans/p-2' }).flush(null);
      backend.expectOne('/api/teacher/textbooks/plans?bank=true').flush([aPlanSummary()]);
      await fixture.whenStable();
      expect(shownTitles('lesson-plans')).toEqual(['Present Simple']);
    });

    it('says the bank is empty', async () => {
      await render({ tab: 'plans' }, 1280, [], []);
      expect(host.textContent).toContain('Планов в банке пока нет');
    });
  });

  describe('assignments', () => {
    const courses = [aCourse({ id: 'c-1', name: 'Английский' })];

    it('shows the bank of assignments on ?tab=assignments, filtered by course and search, sorted', async () => {
      await render({ tab: 'assignments' }, 1280, courses);
      expect(host.querySelector('[hidden] tb-homework-bank-feed')).toBeNull();
      expect(chips()).toEqual([]);
      expect(shownTitles('homework-bank')).toEqual(['Глаголы', 'Дроби']);
      expect(host.textContent).toContain('Английский · Использовано 2 раза');
      expect(host.textContent).toContain('Без курса · Ещё не использовалось');

      fixture.componentRef.setInput('course', 'c-1');
      await fixture.whenStable();
      expect(shownTitles('homework-bank')).toEqual(['Дроби']);
      fixture.componentRef.setInput('course', undefined);
      const search = host.querySelector<HTMLInputElement>('input[type="search"]');
      if (search === null) throw new Error('No search');
      typeInto(search, 'англ');
      await fixture.whenStable();
      expect(shownTitles('homework-bank')).toEqual(['Дроби']);
      typeInto(search, '');
      await fixture.whenStable();

      buttonByText(host, 'Сначала изменённые').click();
      await fixture.whenStable();
      menuItemByText('По названию').click();
      await fixture.whenStable();
      expect(shownTitles('homework-bank')).toEqual(['Глаголы', 'Дроби']);
    });

    it('creates a bank item with «Новое задание», edits and deletes one from «⋮»', async () => {
      await render({ tab: 'assignments' });
      TestBed.createComponent(ConfirmHost).detectChanges();
      const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
      buttonByText(host, 'Новое задание').click();
      expect(navigate).toHaveBeenCalledWith(['/teacher/homework/new'], {
        queryParams: { bank: true },
      });

      host.querySelector<HTMLButtonElement>('button[aria-label="Действия: Дроби"]')?.click();
      await fixture.whenStable();
      menuItemByText('Изменить').click();
      expect(navigate).toHaveBeenLastCalledWith(['/teacher/homework', 'b-1', 'edit']);

      host.querySelector<HTMLButtonElement>('button[aria-label="Действия: Глаголы"]')?.click();
      await fixture.whenStable();
      menuItemByText('Удалить…').click();
      await fixture.whenStable();
      expect(bodyText()).toContain('Задания учеников, сделанные из него, останутся');
      buttonByText(document.body, 'Удалить').click();
      await fixture.whenStable();
      backend
        .expectOne({ method: 'DELETE', url: '/api/teacher/homework/assignments/b-2' })
        .flush(null);
      backend.expectOne(BANK).flush([bankItem({ id: 'b-1', title: 'Дроби' })]);
      await fixture.whenStable();
      expect(shownTitles('homework-bank')).toEqual(['Дроби']);
    });

    it('says the bank is empty and opens a new item from the FAB of a phone', async () => {
      await render({ tab: 'assignments' }, 360, [], [], []);
      expect(host.textContent).toContain('Заданий в банке пока нет');
      const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
      host.querySelector<HTMLElement>('.tb-page-fab button')?.click();
      expect(navigate).toHaveBeenCalledWith(['/teacher/homework/new'], {
        queryParams: { bank: true },
      });
    });
  });
});
