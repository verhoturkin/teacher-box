import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CallParticipant } from './call-engine';
import { CallSide, injectCornerDrag } from './call-corner';
import { CallTile } from './call-tile';

const SIDES: Readonly<Record<string, CallSide>> = {
  ArrowUp: 'top',
  ArrowDown: 'bottom',
  ArrowLeft: 'left',
  ArrowRight: 'right',
};

/**
 * The own camera over the stage of a one-to-one call, as in messengers: a small tile in a corner, dragged
 * to any corner (or moved with the arrow keys) and remembered on the device.
 */
@Component({
  selector: 'tb-call-self',
  imports: [CallTile],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class]': "'tb-call-self tb-call-self--' + place.corner()",
    '[class.tb-call-self--dragging]': 'place.dragging()',
    '[style.translate]': 'place.offset()',
    tabindex: '0',
    'aria-description': 'Перетащите или сдвиньте стрелками в другой угол',
    '(pointerdown)': 'place.start($event)',
    '(pointermove)': 'place.move($event)',
    '(pointerup)': 'place.end()',
    '(pointercancel)': 'place.cancel()',
    '(keydown)': 'key($event)',
  },
  template: `<tb-call-tile [participant]="participant()" />`,
})
export class CallSelf {
  readonly participant = input.required<CallParticipant>();

  protected readonly place = injectCornerDrag('tb-call-self-corner');

  protected key(event: KeyboardEvent): void {
    const side = SIDES[event.key];
    if (side !== undefined) {
      event.preventDefault();
      this.place.toward(side);
    }
  }
}
