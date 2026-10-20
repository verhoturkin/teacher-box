import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { aBoard, aLinkBoard } from '@testing/boards-fixtures';
import { bodyText, buttonByText, hostElement, menuItemByText, typeInto } from '@testing/dom';
import { aGroup, aStudent } from '@testing/identity-fixtures';
import { screenWidth, testProviders } from '@testing/setup';
import { aTextbook, aWorkbook } from '@testing/textbooks-fixtures';
import { MaterialsPage } from './materials-page';

describe('MaterialsPage', () => {
  let fixture: ComponentFixture<MaterialsPage>;
  let backend: HttpTestingController;
  let host: HTMLElement;

  async function render(
    inputs: { tab?: string; student?: string; group?: string } = {},
    width = 1280,
    boardsUrl = '/api/teacher/boards',
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
    backend
      .expectOne('/api/teacher/groups')
      .flush([
        aGroup({ id: 'g-1', name: 'ОГЭ' }),
        aGroup({ id: 'old', archivedAt: '2026-01-01T00:00:00Z' }),
      ]);
    backend.expectOne(boardsUrl).flush([aBoard(), aLinkBoard()]);
    backend
      .expectOne('/api/teacher/textbooks')
      .flush([aTextbook({ hasCover: false }), aWorkbook({ hasCover: false })]);
    await fixture.whenStable();
    host = hostElement(fixture);
  }

  afterEach(() => {
    backend.verify();
    fixture.destroy();
  });

  function segments(): string[] {
    return [...host.querySelectorAll('.tb-segment')].map((segment) =>
      segment.textContent.replace(/\s+/g, ' ').trim(),
    );
  }

  function chips(): string[] {
    return [...host.querySelectorAll('.tb-filter-chip')].map((chip) => chip.textContent.trim());
  }

  function chip(label: string): HTMLButtonElement {
    const found = [...host.querySelectorAll<HTMLButtonElement>('.tb-filter-chip')].find((item) =>
      item.textContent.includes(label),
    );
    if (found === undefined) throw new Error(`No chip ${label}`);
    return found;
  }

  function shownTitles(tab: 'boards' | 'textbooks'): string[] {
    const feed = host.querySelector(`tb-${tab}-feed`);
    return [...(feed?.querySelectorAll('.tb-material-card__title') ?? [])].map((link) =>
      link.textContent.trim(),
    );
  }

  it('shows boards by default with the numbers of both kinds in the connected group', async () => {
    await render();

    expect(segments()).toEqual(['Доски2', 'Учебники2']);
    expect(chips()).toEqual(['Все', 'На портале', 'Внешние', 'Ученик или группа']);
    expect(host.querySelector('[hidden] tb-boards-feed')).toBeNull();
    expect(host.querySelector('[hidden] tb-textbooks-feed')).not.toBeNull();
    expect(shownTitles('boards')).toHaveLength(2);
  });

  it('shows textbooks on ?tab=textbooks with the chips of their kinds', async () => {
    await render({ tab: 'textbooks' });

    expect(host.querySelector('[hidden] tb-boards-feed')).not.toBeNull();
    expect(host.querySelector('[hidden] tb-textbooks-feed')).toBeNull();
    expect(chips()).toEqual(['Все', 'Учебники', 'Рабочие тетради', 'Другое', 'Ученик или группа']);
    chip('Рабочие тетради').click();
    await fixture.whenStable();
    expect(shownTitles('textbooks')).toEqual(['Рабочая тетрадь']);
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

  it('asks for a student or a group with the last chip and keeps the choice in the address', async () => {
    await render();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    expect(host.querySelector('p-select')).toBeNull();

    chip('Ученик или группа').click();
    await fixture.whenStable();
    expect(host.querySelector('p-select')).not.toBeNull();

    const page = fixture.componentInstance;
    page.selectMember('student:s-1');
    expect(navigate).toHaveBeenLastCalledWith([], {
      queryParams: { student: 's-1', group: null },
      queryParamsHandling: 'merge',
    });
    page.selectMember('group:g-1');
    expect(navigate).toHaveBeenLastCalledWith([], {
      queryParams: { student: null, group: 'g-1' },
      queryParamsHandling: 'merge',
    });
    page.selectMember(null);
    expect(navigate).toHaveBeenLastCalledWith([], {
      queryParams: { student: null, group: null },
      queryParamsHandling: 'merge',
    });
  });

  it('takes a student of the address: their boards, the member chip, textbooks open to them', async () => {
    await render({ student: 's-1' }, 1280, '/api/teacher/boards?studentId=s-1');

    expect(chip('Ученик или группа').getAttribute('aria-pressed')).toBe('true');
    expect(host.querySelector('p-select')).not.toBeNull();
    expect(shownTitles('textbooks')).toEqual(['Spotlight 5']);

    // another chip drops the student from the address
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    chip('Все').click();
    expect(navigate).toHaveBeenLastCalledWith([], {
      queryParams: { student: null, group: null },
      queryParamsHandling: 'merge',
    });
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
    expect(host.querySelectorAll('.tb-segment')).toHaveLength(2);
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
  });
});
