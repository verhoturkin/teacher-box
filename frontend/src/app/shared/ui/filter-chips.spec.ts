import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { hostElement, readableText } from '@testing/dom';
import { testProviders } from '@testing/setup';
import { FilterChip, FilterChips, fitChips } from './filter-chips';

type Kind = 'all' | 'debtors' | 'off';

@Component({
  imports: [FilterChips],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<tb-filter-chips label="Фильтр" [chips]="chips" [(value)]="value" />`,
})
class Host {
  readonly chips: FilterChip<Kind>[] = [
    { value: 'all', label: 'Все' },
    { value: 'debtors', label: 'Должники', count: 2 },
    { value: 'off', label: 'Отключённые', count: 0 },
  ];
  readonly value = signal<Kind>('all');
}

@Component({
  imports: [FilterChips],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<tb-filter-chips label="Фильтр" [chips]="chips" [(value)]="value" [oneRow]="true" />`,
})
class OneRowHost {
  readonly chips: FilterChip<string>[] = [
    { value: 'all', label: 'Все' },
    { value: 'a', label: 'Анна', count: 2 },
    { value: 'b', label: 'Борис' },
    { value: 'c', label: 'Вера' },
  ];
  readonly value = signal('all');
}

describe('fitChips', () => {
  const widths = [60, 80, 80, 80];

  it('keeps everything in the row when it fits or is not laid out', () => {
    expect(fitChips(widths, new Set([0]), 0, 90, 8)).toBeNull();
    expect(fitChips(widths, new Set([0]), 340, 90, 8)).toBeNull();
  });

  it('keeps the first chips that fit next to the «Ещё» button', () => {
    expect([...(fitChips(widths, new Set([0]), 250, 90, 8) ?? [])]).toEqual([0, 1]);
  });

  it('always keeps the required chips, even a late chosen one', () => {
    expect([...(fitChips(widths, new Set([0, 3]), 250, 90, 8) ?? [])]).toEqual([0, 3]);
  });
});

describe('FilterChips in one row', () => {
  let fixture: ComponentFixture<OneRowHost>;
  let host: HTMLElement;

  // jsdom has no layout: every chip is 80 px wide, the row 200 px
  beforeEach(async () => {
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(80);
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(200);
    TestBed.configureTestingModule({ providers: testProviders() });
    fixture = TestBed.createComponent(OneRowHost);
    host = hostElement(fixture);
    await fixture.whenStable();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function row(): string[] {
    return Array.from(host.querySelectorAll<HTMLElement>('.tb-filter-chip'))
      .filter((chip) => !chip.classList.contains('tb-filter-chip--overflow'))
      .map((chip) => readableText(chip));
  }

  it('moves the chips that do not fit to «Ещё N»', () => {
    expect(row()).toEqual(['Все', 'Ещё 3']);
  });

  it('keeps the chosen chip in the row', async () => {
    fixture.componentInstance.value.set('c');
    await fixture.whenStable();

    expect(row()).toEqual(['Все', 'Вера', 'Ещё 2']);
  });

  it('chooses a chip of the menu', async () => {
    host.querySelector<HTMLButtonElement>('.tb-filter-chip--more')?.click();
    await fixture.whenStable();
    const items = Array.from(document.body.querySelectorAll<HTMLElement>('[role="menuitem"]'));

    expect(items.map((item) => readableText(item))).toEqual(['Анна 2', 'Борис', 'Вера']);
    items[1]?.querySelector<HTMLElement>('a, .p-menu-item-link')?.click();
    await fixture.whenStable();

    expect(fixture.componentInstance.value()).toBe('b');
  });
});

describe('FilterChips', () => {
  let fixture: ComponentFixture<Host>;
  let host: HTMLElement;

  beforeEach(async () => {
    fixture = TestBed.createComponent(Host);
    host = hostElement(fixture);
    await fixture.whenStable();
  });

  function chips(): HTMLButtonElement[] {
    return Array.from(host.querySelectorAll('button'));
  }

  it('is a named group of toggle buttons, one of them pressed', () => {
    const set = host.querySelector('tb-filter-chips');
    expect(set?.getAttribute('role')).toBe('group');
    expect(set?.getAttribute('aria-label')).toBe('Фильтр');
    expect(chips().map((chip) => readableText(chip))).toEqual(['Все', 'Должники 2', 'Отключённые']);
    expect(chips().map((chip) => chip.getAttribute('aria-pressed'))).toEqual([
      'true',
      'false',
      'false',
    ]);
    expect(chips()[0]?.querySelector('.tb-i-check')).not.toBeNull();
    expect(chips()[0]?.type).toBe('button');
  });

  it('chooses one chip and unselects the others', async () => {
    chips()[1]?.click();
    await fixture.whenStable();

    expect(fixture.componentInstance.value()).toBe('debtors');
    expect(chips().map((chip) => chip.classList.contains('tb-filter-chip--selected'))).toEqual([
      false,
      true,
      false,
    ]);
    expect(chips()[0]?.querySelector('.tb-i-check')).toBeNull();
  });
});

@Component({
  imports: [FilterChips],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<tb-filter-chips label="Фильтр" [chips]="chips" [menu]="menu()" [(value)]="value" />`,
})
class MenuHost {
  readonly chips: FilterChip<string>[] = [{ value: 'all', label: 'Все' }];
  readonly value = signal('all');
  readonly picked = signal('');
  readonly menu = signal({
    label: 'Кому: все',
    selected: false,
    items: [
      {
        label: 'Анна',
        command: () => {
          this.picked.set('Анна');
        },
      },
    ],
  });
}

describe('FilterChips with a menu chip', () => {
  it('opens a menu from the trailing chip and shows a choice in force as selected', async () => {
    const fixture = TestBed.createComponent(MenuHost);
    const host = hostElement(fixture);
    await fixture.whenStable();

    const chip = host.querySelector<HTMLButtonElement>('.tb-filter-chip--menu');
    expect(chip?.getAttribute('aria-haspopup')).toBe('menu');
    expect(chip?.getAttribute('aria-expanded')).toBe('false');
    expect(chip?.classList).not.toContain('tb-filter-chip--selected');
    chip?.click();
    await fixture.whenStable();
    expect(chip?.getAttribute('aria-expanded')).toBe('true');
    document.body.querySelector<HTMLAnchorElement>('.p-menu a.p-menu-item-link')?.click();
    await fixture.whenStable();
    expect(fixture.componentInstance.picked()).toBe('Анна');

    fixture.componentInstance.menu.update((menu) => ({ ...menu, selected: true }));
    await fixture.whenStable();
    expect(chip?.classList).toContain('tb-filter-chip--selected');
  });
});
