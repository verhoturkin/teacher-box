import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { hostElement } from '@testing/dom';
import { Step, Steps } from './steps';

const STEPS: readonly Step<number>[] = [
  { id: 1, title: 'One' },
  { id: 2, title: 'Two' },
  { id: 3, title: 'Three', disabled: true },
];

@Component({
  imports: [Steps],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <tb-steps
      [steps]="steps"
      [current]="current()"
      label="Steps"
      [selectable]="selectable()"
      (selected)="current.set($event)"
    >
      <ng-template
        ><p class="body">Body {{ current() }}</p></ng-template
      >
    </tb-steps>
  `,
})
class Host {
  readonly steps = STEPS;
  readonly current = signal(2);
  readonly selectable = signal(false);
}

function render(selectable: boolean): { host: HTMLElement; app: Host } {
  const fixture = TestBed.createComponent(Host);
  fixture.componentInstance.selectable.set(selectable);
  fixture.detectChanges();
  return { host: hostElement(fixture), app: fixture.componentInstance };
}

describe('Steps', () => {
  it('numbers the steps, checks the done ones and marks the current one', () => {
    const { host } = render(false);
    const steps = host.querySelectorAll('li');
    expect(host.querySelector('ol')?.getAttribute('aria-label')).toBe('Steps');
    expect(steps).toHaveLength(3);
    expect(steps[0]?.querySelector('.tb-i-check')).not.toBeNull();
    expect(steps[0]?.classList).toContain('tb-steps__step--done');
    expect(host.querySelector('[aria-current="step"]')?.textContent).toContain('Two');
    expect(steps[2]?.textContent).toContain('3');
    expect(host.querySelector('button')).toBeNull();
    expect(steps[1]?.querySelector('.body')?.textContent).toContain('Body 2');
  });

  it('opens a selectable step and shows the body under it', () => {
    const { host, app } = render(true);
    const buttons = host.querySelectorAll('button');
    expect(buttons[2]?.disabled).toBe(true);

    buttons[0]?.click();
    TestBed.tick();
    expect(app.current()).toBe(1);
    expect(host.querySelector('[aria-current="step"]')?.textContent).toContain('One');
    expect(host.querySelectorAll('li')[0]?.querySelector('.body')?.textContent).toContain('Body 1');
  });
});
