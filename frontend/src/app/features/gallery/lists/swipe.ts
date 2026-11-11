import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { Swipe } from '@shared/ui/swipe';

/**
 * §10 Swipe `tbSwipe` (a phone, touch only): the row follows the finger and fades; at 30 % of its width it acts
 * (`tbSwiped`), otherwise it comes back. Try it with touch emulation.
 */
@Component({
  selector: 'tb-gallery-swipe',
  imports: [Swipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ul class="tb-list tb-list--no-lead">
      @if (shown()) {
        <li [tbSwipe]="true" (tbSwiped)="shown.set(false)">
          <div class="tb-list__text">
            <span class="tb-list__title">New submission</span>
            <span class="tb-list__supporting">Swipe aside to mark as read</span>
          </div>
        </li>
      }
      <li>
        <div class="tb-list__text">
          <span class="tb-list__title">A row without tbSwipe</span>
        </div>
      </li>
    </ul>
    <code class="tb-gallery-name">li [tbSwipe]="true" (tbSwiped)</code>
  `,
})
export class SwipeSample {
  protected readonly shown = signal(true);
}
