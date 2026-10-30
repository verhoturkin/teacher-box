import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { hostElement, readableText } from '@testing/dom';
import { Segment, SegmentGroup } from './segment-group';

type Kind = 'review' | 'active' | 'done';

@Component({
  imports: [SegmentGroup],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<tb-segment-group label="Что показать" [segments]="segments" [(value)]="value" />`,
})
class Host {
  readonly segments: Segment<Kind>[] = [
    { value: 'review', label: 'На проверку', count: 3 },
    { value: 'active', label: 'Активные', count: 0 },
    { value: 'done', label: 'Готовые' },
  ];
  readonly value = signal<Kind>('review');
}

@Component({
  imports: [SegmentGroup],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<tb-segment-group
    label="Вид"
    [outlined]="true"
    [checkmark]="check()"
    [segments]="segments"
    [(value)]="value"
  />`,
})
class OutlinedHost {
  readonly segments: Segment<'a' | 'b'>[] = [
    { value: 'a', label: 'A', icon: 'tb-i tb-i-view_list' },
    { value: 'b', label: 'B', icon: 'tb-i tb-i-grid_view' },
  ];
  readonly value = signal<'a' | 'b'>('a');
  readonly check = signal(true);
}

describe('outlined SegmentGroup', () => {
  it('carries the variant class and a check in the chosen button', async () => {
    const outlined = TestBed.createComponent(OutlinedHost);
    await outlined.whenStable();
    const el = hostElement(outlined);
    expect(el.querySelector('tb-segment-group')?.classList).toContain('tb-segment-group--outlined');
    const icons = Array.from(el.querySelectorAll('button')).map(
      (b) => b.querySelector('i')?.className,
    );
    expect(icons).toEqual(['tb-i tb-i-check', 'tb-i tb-i-grid_view']);
  });

  it('keeps the icons when the check is off', async () => {
    const outlined = TestBed.createComponent(OutlinedHost);
    outlined.componentInstance.check.set(false);
    await outlined.whenStable();
    const icons = Array.from(hostElement(outlined).querySelectorAll('button')).map(
      (b) => b.querySelector('i')?.className,
    );
    expect(icons).toEqual(['tb-i tb-i-view_list', 'tb-i tb-i-grid_view']);
  });
});

describe('SegmentGroup', () => {
  let fixture: ComponentFixture<Host>;
  let host: HTMLElement;

  beforeEach(async () => {
    fixture = TestBed.createComponent(Host);
    host = hostElement(fixture);
    await fixture.whenStable();
  });

  function buttons(): HTMLButtonElement[] {
    return Array.from(host.querySelectorAll('button'));
  }

  it('is a named group of toggle buttons with their counts, one of them pressed', () => {
    const group = host.querySelector('tb-segment-group');
    expect(group?.getAttribute('role')).toBe('group');
    expect(group?.getAttribute('aria-label')).toBe('Что показать');
    expect(buttons().map((button) => readableText(button))).toEqual([
      'На проверку 3',
      'Активные 0',
      'Готовые',
    ]);
    expect(buttons().map((button) => button.getAttribute('aria-pressed'))).toEqual([
      'true',
      'false',
      'false',
    ]);
  });

  it('presses the chosen button and releases the others', async () => {
    buttons()[2]?.click();
    await fixture.whenStable();

    expect(fixture.componentInstance.value()).toBe('done');
    expect(buttons().map((button) => button.getAttribute('aria-pressed'))).toEqual([
      'false',
      'false',
      'true',
    ]);
  });
});
