import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { LessonTime } from '../home/lesson-clock';

/**
 * The time of the nearest lesson as a calendar event: the day, the start in large type, the
 * duration or the countdown under it. Filled with the portal colour on the hero card.
 */
@Component({
  selector: 'tb-lesson-time-tile',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.tb-time-tile--live]': "time().phase === 'live'" },
  template: `
    <span class="tb-time-tile__day">{{ time().day }}</span>
    <span class="tb-time-tile__start">{{ time().start }}</span>
    <span class="tb-time-tile__note">{{ time().note }}</span>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-width: 7.5rem;
      padding: var(--tb-space-3) var(--tb-space-4);
      border-radius: var(--tb-shape-lg);
      background: var(--p-md-primary);
      color: var(--p-md-on-primary);
      text-align: center;
    }

    .tb-time-tile__day,
    .tb-time-tile__note {
      font: var(--tb-type-label-l);
    }

    .tb-time-tile__start {
      font: var(--tb-type-headline-m-emphasized);
    }
  `,
})
export class LessonTimeTile {
  readonly time = input.required<LessonTime>();
}
