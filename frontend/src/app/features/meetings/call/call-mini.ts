import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { Button } from 'primeng/button';
import { injectMobile } from '@core/layout/mobile';
import { CallControls } from './call-controls';
import { injectCornerDrag } from './call-corner';
import { miniView } from './call-layout';
import { CallSession } from './call-session';
import { CallTile } from './call-tile';
import { T } from '../i18n/texts';

/**
 * The minimized call: on a computer a floating window with whoever matters now (a shared screen, the
 * speaker, a camera), dragged by its top line to any corner (remembered on the device) or moved with
 * «Переместить»; on a phone a bar above the bottom navigation. Opens the full window on «Развернуть».
 */
@Component({
  selector: 'tb-call-mini',
  imports: [Button, CallControls, CallTile],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'region',
    '[attr.aria-label]': 't.call',
    '[class]':
      "'tb-call-mini tb-call-mini--' + place.corner() + (mobile() ? ' tb-call-mini--bar' : '')",
    '[class.tb-call-mini--dragging]': 'place.dragging()',
    '[style.translate]': 'place.offset()',
  },
  template: `
    <div
      class="tb-call-mini__head"
      (pointerdown)="startDrag($event)"
      (pointermove)="place.move($event)"
      (pointerup)="place.end()"
      (pointercancel)="place.cancel()"
    >
      <span class="tb-call-mini__title">
        <span class="tb-call-mini__name">{{ session.target()?.title }}</span>
        <span class="tb-call-mini__time">{{
          session.phase() === 'reconnecting' ? t.reconnecting : elapsed()
        }}</span>
      </span>
      @if (!mobile()) {
        <p-button
          icon="pi pi-arrows-alt"
          [text]="true"
          [rounded]="true"
          severity="secondary"
          [ariaLabel]="t.move"
          (onClick)="place.next()"
        />
      }
    </div>
    @if (!mobile()) {
      @if (view(); as shown) {
        <tb-call-tile
          class="tb-call-mini__tile"
          [participant]="shown.participant"
          [screen]="shown.screen"
        />
      }
    }
    <tb-call-controls [compact]="true" />
  `,
})
export class CallMini {
  protected readonly t = T.mini;
  protected readonly session = inject(CallSession);
  protected readonly mobile = injectMobile();

  readonly elapsed = input('');

  protected readonly view = computed(() => miniView(this.session.participants()));
  protected readonly place = injectCornerDrag('tb-call-corner');

  /** Dragged by the top line on a computer, not by its buttons. */
  protected startDrag(event: PointerEvent): void {
    const pressed = event.target;
    if (this.mobile() || (pressed instanceof Element && pressed.closest('button') !== null)) {
      return;
    }
    this.place.start(event);
  }
}
