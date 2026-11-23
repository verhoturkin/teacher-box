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
    await render({ tab: 'boards', q: 'Мария' });
    expect(host.querySelector<HTMLInputElement>('input[type="search"], input')?.value).toBe(
      'Мария',
    );
  });

  const courses = [aCourse({ id: 'c-1', name: 'Английский' }), aCourse({ id: 'c-2', name: 'ОГЭ' })];

  /** The rows of the list pane: the name and the count. */
  function rows(): string[] {
    return [...host.querySelectorAll('nav li')].map((row) => {
      const label = row.querySelector('.tb-nav-menu__link')?.firstChild?.textContent?.trim() ?? '';
      const count = row.querySelector('.tb-nav-menu__count')?.textContent.trim();
      return count === undefined ? label : `${label} ${count}`;
    });
  }

  function link(label: string): HTMLAnchorElement {
    const found = [...host.querySelectorAll<HTMLAnchorElement>('nav a.tb-nav-menu__link')].find(
      (item) => item.textContent.includes(label),
    );
    if (found === undefined) throw new Error(`No row ${label}`);
    return found;
  }

  function current(): string | undefined {
    return host.querySelector('nav [aria-current="page"]')?.firstChild?.textContent?.trim();
  }

  function tabs(): string[] {
    return [...host.querySelectorAll('p-tab')].map((tab) => tab.textContent.trim());
  }

  function shownTitles(tab: 'boards' | 'textbooks' | 'lesson-plans' | 'homework-bank'): string[] {
    const feed = host.querySelector(`tb-${tab}-feed`);
    return [...(feed?.querySelectorAll('.tb-material-card__title') ?? [])].map((card) =>
      card.textContent.trim(),
    );
  }

  function visible(): string | undefined {
    return [...host.querySelectorAll('tb-pane div:not([hidden]) > *')]
      .map((feed) => feed.tagName.toLowerCase())
      .find((tag) => tag.endsWith('-feed'));
  }

  async function pick(menuButton: string, item: string): Promise<void> {
    buttonByText(host, menuButton).click();
    await fixture.whenStable();
    menuItemByText(item).click();
    await fixture.whenStable();
  }

  it('lists «Все материалы», the courses, «Без курса» and «Доски» with their counts', async () => {
    await render({}, 1280, courses);

    expect(rows()).toEqual([
      'Все материалы 6',
      'Английский 3',
      'ОГЭ 0',
      'Новый курс',
      'Без курса 3',
      'Доски 2',
    ]);
    expect(current()).toBe('Все материалы');
    expect(host.querySelector('h2')?.textContent.trim()).toBe('Все материалы');
    expect(tabs()).toEqual(['Учебники', 'Планы', 'Задания']);
    expect(visible()).toBe('tb-textbooks-feed');
    expect(shownTitles('textbooks')).toHaveLength(2);
    expect(host.querySelectorAll('.tb-i-collections_bookmark')).toHaveLength(2);
    // a row keeps the tab in sight
    expect(link('Без курса').getAttribute('href')).toBe('/?course=none&tab=textbooks');
    expect(link('Английский').getAttribute('href')).toBe('/?course=c-1&tab=textbooks');
    expect(link('Доски').getAttribute('href')).toBe('/?tab=boards');
    expect(link('Все материалы').getAttribute('href')).toBe('/?tab=textbooks');
  });

  it('shows the materials of the course of `?course=` and picks the textbook kind in «Фильтр»', async () => {
    await render({ tab: 'textbooks', course: 'c-1' }, 1280, courses);
    expect(current()).toBe('Английский');
    expect(host.querySelector('h2')?.textContent.trim()).toBe('Английский');
    expect(shownTitles('textbooks')).toEqual(['Spotlight 5']);
    expect(link('Все материалы').getAttribute('href')).toBe('/?tab=textbooks');

    fixture.componentRef.setInput('course', 'none');
    await fixture.whenStable();
    expect(current()).toBe('Без курса');
    expect(shownTitles('textbooks')).toEqual(['Рабочая тетрадь']);

    fixture.componentRef.setInput('course', undefined);
    await fixture.whenStable();
    await pick('Фильтр', 'Рабочие тетради');
    expect(shownTitles('textbooks')).toEqual(['Рабочая тетрадь']);
    expect(buttonByText(host, 'Фильтр: Рабочие тетради')).toBeTruthy();
    // another kind starts with «Все» again
    fixture.componentRef.setInput('tab', 'plans');
    await fixture.whenStable();
    expect(host.querySelector('button[aria-label^="Фильтр"]')).toBeNull();
    fixture.componentRef.setInput('tab', 'textbooks');
    await fixture.whenStable();
    expect(shownTitles('textbooks')).toHaveLength(2);
  });

  it('ignores a course that is gone', async () => {
    await render({ tab: 'textbooks', course: 'gone' }, 1280, courses);
    expect(current()).toBe('Все материалы');
    expect(shownTitles('textbooks')).toHaveLength(2);
  });

  it('puts the tab into the address', async () => {
    await render({}, 1280, courses);
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    host.querySelectorAll<HTMLElement>('p-tab')[1]?.click();

    expect(navigate).toHaveBeenCalledWith([], {
      queryParams: { tab: 'plans' },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  });

  it('shows the boards on `?tab=boards` without tabs, filtered, searched and sorted', async () => {
    await render({ tab: 'boards' });
    expect(current()).toBe('Доски');
    expect(tabs()).toEqual([]);
    expect(visible()).toBe('tb-boards-feed');

    await pick('Фильтр', 'Внешние');
    expect(shownTitles('boards')).toEqual(['Холст']);
    await pick('Фильтр: Внешние', 'Все');

    const search = host.querySelector<HTMLInputElement>('input[type="search"]');
    if (search === null) throw new Error('No search');
    typeInto(search, 'алгебра');
    await fixture.whenStable();
    expect(shownTitles('boards')).toEqual(['Алгебра']);
    // the textbooks feed hears the same search
    expect(shownTitles('textbooks')).toEqual([]);
    typeInto(search, '');
    await fixture.whenStable();

    await pick('Сначала изменённые', 'По названию');
    expect(shownTitles('boards')).toEqual(['Алгебра', 'Холст']);
    expect(host.textContent).toContain('По названию');
  });

  describe('«Создать»', () => {
    it('has no button of its own on a wide screen: the rail’s «Создать» is the only one', async () => {
      await render({ tab: 'textbooks' }, 1280, courses);
      expect(host.querySelector('[aria-haspopup="menu"][aria-label="Создать"]')).toBeNull();
      expect(host.textContent).not.toContain('Создать');
    });

    it('opens the editor of a plan from the rail with the chosen course', async () => {
      await render({ tab: 'plans', course: 'c-1' }, 1280, courses);
      const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
      await TestBed.inject(Router).navigateByUrl('/?create=plan');
      await fixture.whenStable();
      expect(navigate).toHaveBeenCalledWith(['/teacher/materials/plans/new'], {
        queryParams: { course: 'c-1' },
      });
    });

    it('opens the form of a new textbook from the rail with the chosen course', async () => {
      await render({ tab: 'plans', course: 'c-2' }, 1280, courses);
      await TestBed.inject(Router).navigateByUrl('/?create=textbook');
      await fixture.whenStable();
      expect(bodyText()).toContain('Новый учебник');
      expect(document.querySelector('.p-dialog .p-select-label')?.textContent).toContain('ОГЭ');
      expect(bodyText()).not.toContain('Новая доска');
    });

    it('opens the form of a new board from the rail', async () => {
      await render();
      await TestBed.inject(Router).navigateByUrl('/?create=board');
      await fixture.whenStable();
      expect(bodyText()).toContain('Новая доска');
    });
  });

  it('reads the textbooks, plans and assignments again after a course is renamed', async () => {
    await render({ tab: 'textbooks' }, 1280, courses);
    host.querySelector<HTMLButtonElement>('button[aria-label="Действия с курсом «ОГЭ»"]')?.click();
    await fixture.whenStable();
    menuItemByText('Переименовать').click();
    await fixture.whenStable();
    const field = host.querySelector<HTMLInputElement>('nav input');
    if (field === null) throw new Error('No field');
    typeInto(field, 'ЕГЭ');
    field.form?.dispatchEvent(new Event('submit'));
    backend
      .expectOne({ method: 'PUT', url: '/api/teacher/textbooks/courses/c-2' })
      .flush(aCourse({ id: 'c-2', name: 'ЕГЭ' }));
    backend.expectOne('/api/teacher/textbooks').flush([aTextbook({ hasCover: false })]);
    backend.expectOne('/api/teacher/textbooks/plans?bank=true').flush([]);
    backend.expectOne(BANK).flush([]);
    await fixture.whenStable();
    expect(rows()).toContain('ЕГЭ 0');
    expect(shownTitles('textbooks')).toEqual(['Spotlight 5']);
  });

  describe('on a phone', () => {
    it('shows the list without a selection, its counts and the FAB menu', async () => {
      await render({}, 360, courses);
      const detail = host.querySelectorAll<HTMLElement>('tb-pane')[1];
      expect(detail?.style.display).toBe('none');
      expect(rows()[0]).toBe('Все материалы 6');
      expect(current()).toBeUndefined();
      expect(host.querySelector('nav.tb-nav-menu')?.classList).toContain('tb-nav-menu--touch');
      expect(host.querySelector('.tb-page-header [aria-haspopup="menu"]')).toBeNull();

      const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
      buttonByText(host, 'Создать').click();
      await fixture.whenStable();
      buttonByText(host, 'Задание').click();
      expect(navigate).toHaveBeenCalledWith(['/teacher/homework/new'], {
        queryParams: { bank: true },
      });
    });

    it('shows the detail of a row with «back» to the list', async () => {
      await render({ tab: 'textbooks', course: 'c-1' }, 360, courses);
      expect(host.querySelectorAll('tb-pane')).toHaveLength(1);
      expect(host.querySelector('h1')?.textContent).toContain('Английский');
      expect(host.querySelector('a[aria-label="Материалы"]')?.getAttribute('href')).toBe(
        '/teacher/materials',
      );
      expect(shownTitles('textbooks')).toEqual(['Spotlight 5']);
    });
  });

  describe('plans', () => {
    it('shows the templates on ?tab=plans with the course and the uses, filtered by course and search', async () => {
      await render({ tab: 'plans' }, 1280, courses);
      expect(visible()).toBe('tb-lesson-plans-feed');
      expect(shownTitles('lesson-plans')).toEqual(['Present Simple', 'Past Simple']);
      expect(host.textContent).toContain('Английский · Использовано 3 раза');
      expect(host.textContent).toContain('Без курса · Ещё не использовался');
      expect(
        host.querySelector<HTMLInputElement>('input[type="search"]')?.getAttribute('aria-label') ??
          host.textContent,
      ).toContain('Название или курс');

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

    it('edits and deletes a template from «⋮»', async () => {
      await render({ tab: 'plans' });
      TestBed.createComponent(ConfirmHost).detectChanges();
      const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
      expect(() => buttonByText(host, 'Новый план')).toThrow();

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

    it('says there are no templates yet', async () => {
      await render({ tab: 'plans' }, 1280, [], []);
      expect(host.textContent).toContain('Шаблонов планов пока нет');
    });
  });

  describe('assignments', () => {
    it('shows the templates on ?tab=assignments, filtered by course and search, sorted', async () => {
      await render({ tab: 'assignments' }, 1280, courses);
      expect(visible()).toBe('tb-homework-bank-feed');
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

      await pick('Сначала изменённые', 'По названию');
      expect(shownTitles('homework-bank')).toEqual(['Глаголы', 'Дроби']);
    });

    it('edits and deletes a template from «⋮»', async () => {
      await render({ tab: 'assignments' });
      TestBed.createComponent(ConfirmHost).detectChanges();
      const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

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

    it('says there are no templates yet', async () => {
      await render({ tab: 'assignments' }, 1280, [], [], []);
      expect(host.textContent).toContain('Шаблонов заданий пока нет');
    });
  });
});
