import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { Button } from 'primeng/button';
import { Step, Steps } from '@shared/ui/steps';

const STEPS: readonly Step<number>[] = [
  { id: 1, title: 'Create a bot' },
  { id: 2, title: 'Paste the token' },
  { id: 3, title: 'Check the connection', disabled: true },
];

/**
 * §11 Wizard steps: `tb-steps` — the indicator of the setup wizard (rows only) and the selectable
 * steps of a dialog with the body of the current one under its row (`ng-template`).
 */
@Component({
  selector: 'tb-gallery-steps',
  imports: [Button, Steps],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="tb-gallery-cell">
      <tb-steps [steps]="steps" [current]="2" label="Steps" />
      <code class="tb-gallery-name">tb-steps [steps] [current]</code>
    </div>
    <div class="tb-gallery-cell">
      <tb-steps
        [steps]="steps"
        [current]="step()"
        label="Steps"
        [selectable]="true"
        (selected)="step.set($event)"
      >
        <ng-template>
          <p>The body of step {{ step() }}.</p>
          <p-button label="Back to step 1" [text]="true" (onClick)="step.set(1)" />
        </ng-template>
      </tb-steps>
      <code class="tb-gallery-name">tb-steps [selectable]="true" (selected) + ng-template</code>
    </div>
  `,
})
export class StepsSample {
  protected readonly steps = STEPS;
  protected readonly step = signal(2);
}
