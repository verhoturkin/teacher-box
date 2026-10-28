import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Tooltip } from 'primeng/tooltip';
import { applyTooltipDefaults } from './tooltip-defaults';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Tooltip],
  template: `<button pTooltip="Hi">a</button>
    <button pTooltip="Hi" tooltipPosition="top">b</button>`,
})
class Host {}

describe('applyTooltipDefaults', () => {
  it('places a tooltip below by default and keeps an explicit position', () => {
    applyTooltipDefaults();
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const [a, b] = fixture.debugElement.children.map((c) => c.injector.get(Tooltip));
    expect(a!.getOption('tooltipPosition')).toBe('bottom');
    expect(b!.getOption('tooltipPosition')).toBe('top');
  });
});
