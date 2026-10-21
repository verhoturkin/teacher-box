import type { Mock } from 'vitest';
import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { FileOpener } from '@shared/files/file-opener';
import { aMyBoard } from '@testing/boards-fixtures';
import { buttonByText, hostElement, typeInto } from '@testing/dom';
import { screenWidth, testProviders } from '@testing/setup';
import { aMyTextbook } from '@testing/textbooks-fixtures';
import { MyMaterialsPage } from './my-materials-page';

describe('MyMaterialsPage', () => {
  let fixture: ComponentFixture<MyMaterialsPage>;
  let backend: HttpTestingController;
  let host: HTMLElement;
  let opener: { open: Mock<FileOpener['open']> };

  async function render(inputs: { tab?: string } = {}, width = 1280): Promise<void> {
    opener = { open: vi.fn<FileOpener['open']>() };
    TestBed.configureTestingModule({
      imports: [MyMaterialsPage],
      providers: [...testProviders(screenWidth(width)), { provide: FileOpener, useValue: opener }],
    });
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(MyMaterialsPage);
    for (const [name, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(name, value);
    }
    fixture.detectChanges();
    backend.expectOne('/api/me/boards').flush([
      aMyBoard(),
      aMyBoard({
        id: 'b2',
        kind: 'LINK',
        title: 'Холст',
        url: 'https://app.holst.so/board/2',
        groupNames: ['ОГЭ', 'ЕГЭ'],
      }),
      aMyBoard({ id: 'b3', title: 'Геометрия', groupNames: ['ОГЭ'] }),
    ]);
    backend.expectOne('/api/me/textbooks').flush([
      aMyTextbook({ hasCover: false }),
      aMyTextbook({
        id: 'tb-2',
        kind: 'WORKBOOK',
        title: 'Тетрадь',
        groupNames: [],
        hasCover: false,
        format: 'DOCUMENT',
        course: null,
      }),
    ]);
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

  function chip(label: string): HTMLButtonElement {
    const found = [...host.querySelectorAll<HTMLButtonElement>('.tb-filter-chip')].find(
      (item) => item.textContent.trim() === label,
    );
    if (found === undefined) throw new Error(`No chip ${label}`);
    return found;
  }

  function titles(tab: 'boards' | 'textbooks'): string[] {
    const feed = host.querySelector(`tb-my-${tab}-feed`);
    return [...(feed?.querySelectorAll('.tb-material-card__title') ?? [])].map((link) =>
      link.textContent.trim(),
    );
  }

  it('shows boards as cards without actions, the numbers of both kinds in the group', async () => {
    await render();

    expect(host.querySelector('h1')?.textContent).toContain('Материалы');
    expect(segments()).toEqual(['Доски3', 'Учебники2']);
    expect([...host.querySelectorAll('.tb-filter-chip')].map((c) => c.textContent.trim())).toEqual([
      'Все',
      'На портале',
      'Внешние',
    ]);
    expect(titles('boards')).toEqual(['Алгебра', 'Холст', 'Геометрия']);
    expect(host.querySelector('.tb-material-card__menu')).toBeNull();
    const cards = host.querySelectorAll('tb-my-boards-feed .tb-material-card');
    expect(cards[0]?.querySelector('a')?.getAttribute('href')).toBe('/cabinet/boards/board-1');
    expect(cards[1]?.querySelector('a')?.getAttribute('href')).toBe('https://app.holst.so/board/2');
    expect(cards[1]?.textContent).toContain('группы «ОГЭ», «ЕГЭ»');
    expect(cards[2]?.textContent).toContain('группа «ОГЭ» · 02.10');
  });

  it('filters the boards by chip and by search', async () => {
    await render();
    chip('Внешние').click();
    await fixture.whenStable();
    expect(titles('boards')).toEqual(['Холст']);
    chip('На портале').click();
    await fixture.whenStable();
    expect(titles('boards')).toEqual(['Алгебра', 'Геометрия']);
    chip('Все').click();

    const search = host.querySelector<HTMLInputElement>('input[type="search"]');
    if (search === null) throw new Error('No search');
    typeInto(search, 'гео');
    await fixture.whenStable();
    expect(titles('boards')).toEqual(['Геометрия']);
    typeInto(search, 'нет такой');
    await fixture.whenStable();
    expect(host.querySelector('tb-my-boards-feed')?.textContent).toContain('Ничего не найдено');
  });

  it('shows textbooks on ?tab=textbooks, filters them and opens the file of a card', async () => {
    await render({ tab: 'textbooks' });

    expect([...host.querySelectorAll('.tb-filter-chip')].map((c) => c.textContent.trim())).toEqual([
      'Все',
      'Учебники',
      'Рабочие тетради',
      'Другое',
    ]);
    expect(titles('textbooks')).toEqual(['Spotlight 5', 'Тетрадь']);
    expect(host.querySelector('tb-my-textbooks-feed')?.textContent).toContain('Группа: ОГЭ');
    chip('Рабочие тетради').click();
    await fixture.whenStable();
    expect(titles('textbooks')).toEqual(['Тетрадь']);
    chip('Все').click();
    const search = host.querySelector<HTMLInputElement>('input[type="search"]');
    if (search === null) throw new Error('No search');
    typeInto(search, 'английский');
    await fixture.whenStable();
    expect(titles('textbooks')).toEqual(['Spotlight 5']);
    typeInto(search, 'нет такого');
    await fixture.whenStable();
    expect(host.querySelector('tb-my-textbooks-feed')?.textContent).toContain('Ничего не найдено');
    typeInto(search, 'spot');
    await fixture.whenStable();

    host
      .querySelector<HTMLButtonElement>('tb-my-textbooks-feed button.tb-material-card__title')
      ?.click();
    expect(opener.open).toHaveBeenCalledTimes(1);
    expect(opener.open.mock.calls[0]?.[1]).toBe(true);
    const name = opener.open.mock.calls[0]?.[2];
    expect(name?.(new Blob())).toBe('Spotlight 5.pdf');
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

  it('on a phone has the group above the search and no FAB', async () => {
    await render({}, 500);

    expect(host.querySelectorAll('tb-segment-group')).toHaveLength(1);
    expect(host.querySelector('.tb-page-fab')).toBeNull();
  });
});
