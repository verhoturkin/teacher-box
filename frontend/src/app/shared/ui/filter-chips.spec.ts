import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { hostElement, readableText } from '@testing/dom';
import { FilterChip, FilterChips } from './filter-chips';

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
