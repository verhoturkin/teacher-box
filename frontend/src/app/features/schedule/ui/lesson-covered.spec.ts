import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { hostElement } from '@testing/dom';
import { testProviders } from '@testing/setup';
import { LessonCovered, heldByPlan } from './lesson-covered';

@Component({
  imports: [LessonCovered],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<tb-lesson-covered [summary]="summary()" [byPlan]="byPlan()" />`,
})
class Host {
  readonly summary = signal<string | null>(null);
  readonly byPlan = signal(false);
}

describe('LessonCovered', () => {
  function render(summary: string | null, byPlan: boolean): HTMLElement {
    TestBed.configureTestingModule({ providers: testProviders() });
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.summary.set(summary);
    fixture.componentInstance.byPlan.set(byPlan);
    fixture.detectChanges();
    return hostElement(fixture);
  }

  it('reads «Что прошли» without a plan and nothing without a summary', () => {
    expect(render('Past Simple', false).textContent).toContain('Что прошли');
    TestBed.resetTestingModule();
    expect(render(null, false).textContent.trim()).toBe('');
  });

  it('reads «Прошли по плану» with a plan and the deviations under «Не по плану»', () => {
    const plain = render(null, true);
    expect(plain.textContent).toContain('Прошли по плану');
    expect(plain.textContent).not.toContain('Не по плану');
    TestBed.resetTestingModule();
    const off = render('Не успели упр. 5', true);
    expect(off.textContent).toContain('Прошли по плану');
    expect(off.textContent).toContain('Не по плану');
    expect(off.textContent).toContain('Не успели упр. 5');
  });

  it('counts only a held lesson with a plan', () => {
    expect(heldByPlan({ planId: 'p', status: 'CONDUCTED' })).toBe(true);
    expect(heldByPlan({ planId: 'p', status: 'MISSED' })).toBe(false);
    expect(heldByPlan({ planId: null, status: 'CONDUCTED' })).toBe(false);
  });
});
