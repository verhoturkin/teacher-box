import {
  ChangeDetectionStrategy,
  Component,
  DOCUMENT,
  ElementRef,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { Button } from 'primeng/button';
import { Tooltip } from 'primeng/tooltip';
import { injectMobile } from '@core/layout/mobile';
import { CallControls } from './call-controls';
import { miniView } from './call-layout';
import { CallSession } from './call-session';
import { CallTile } from './call-tile';

/** A corner of the screen the mini window keeps to. */
export type MiniCorner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

const CORNERS: readonly MiniCorner[] = ['bottom-right', 'bottom-left', 'top-left', 'top-right'];
const CORNER_KEY = 'tb-call-corner';

/**
 * The minimized call: on a computer a floating window with whoever matters now (a shared screen, the
 * speaker, a camera), dragged by its top line to any corner (remembered on the device) or moved with
 * «Переместить»; on a phone a bar above the bottom navigation. Opens the full window on «Развернуть».
 */
@Component({
  selector: 'tb-call-mini',
  imports: [Button, Tooltip, CallControls, CallTile],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'region',
    'aria-label': 'Звонок',
    '[class]': "'tb-call-mini tb-call-mini--' + corner() + (mobile() ? ' tb-call-mini--bar' : '')",
    '[class.tb-call-mini--dragging]': 'drag() !== null',
    '[style.translate]': 'offset()',
  },
  template: `
    <div
      class="tb-call-mini__head"
      (pointerdown)="startDrag($event)"
      (pointermove)="moveDrag($event)"
      (pointerup)="endDrag()"
      (pointercancel)="cancelDrag()"
    >
      <span class="tb-call-mini__title">
        <span class="tb-call-mini__name">{{ session.target()?.title }}</span>
        <span class="tb-call-mini__time">{{
          session.phase() === 'reconnecting' ? 'Переподключение…' : elapsed()
        }}</span>
      </span>
      @if (!mobile()) {
        <p-button
          icon="pi pi-arrows-alt"
          [text]="true"
          [rounded]="true"
          severity="secondary"
          ariaLabel="Переместить окно звонка"
          pTooltip="Переместить в другой угол"
          (onClick)="nextCorner()"
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
  protected readonly session = inject(CallSession);
  protected readonly mobile = injectMobile();
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly window = inject(DOCUMENT).defaultView;

  readonly elapsed = input('');

  protected readonly view = computed(() => miniView(this.session.participants()));
  protected readonly corner = signal<MiniCorner>(this.storedCorner());
  protected readonly drag = signal<{ x: number; y: number; dx: number; dy: number } | null>(null);
  protected readonly offset = computed(() => {
    const drag = this.drag();
    return drag === null ? null : `${String(drag.dx)}px ${String(drag.dy)}px`;
  });

  protected nextCorner(): void {
    const index = CORNERS.indexOf(this.corner());
    this.setCorner(CORNERS[(index + 1) % CORNERS.length] ?? 'bottom-right');
  }

  protected startDrag(event: PointerEvent): void {
    const head = event.currentTarget;
    const pressed = event.target;
    if (this.mobile() || (pressed instanceof Element && pressed.closest('button') !== null)) {
      return;
    }
    if (head instanceof Element) {
      head.setPointerCapture(event.pointerId);
    }
    this.drag.set({ x: event.clientX, y: event.clientY, dx: 0, dy: 0 });
  }

  protected moveDrag(event: PointerEvent): void {
    const drag = this.drag();
    if (drag !== null) {
      this.drag.set({ ...drag, dx: event.clientX - drag.x, dy: event.clientY - drag.y });
    }
  }

  /** Snaps the window to the corner nearest to where it was dropped. */
  protected endDrag(): void {
    if (this.drag() === null) {
      return;
    }
    const box = this.host.nativeElement.getBoundingClientRect();
    const width = this.window?.innerWidth ?? box.right;
    const height = this.window?.innerHeight ?? box.bottom;
    const middleX = box.left + box.width / 2;
    const middleY = box.top + box.height / 2;
    this.drag.set(null);
    const top = middleY < height / 2;
    const left = middleX < width / 2;
    this.setCorner(`${top ? 'top' : 'bottom'}-${left ? 'left' : 'right'}`);
  }

  protected cancelDrag(): void {
    this.drag.set(null);
  }

  private setCorner(corner: MiniCorner): void {
    this.corner.set(corner);
    try {
      this.window?.localStorage.setItem(CORNER_KEY, corner);
    } catch {
      // storage is off: the corner lives until the page closes
    }
  }

  private storedCorner(): MiniCorner {
    try {
      const stored = this.window?.localStorage.getItem(CORNER_KEY);
      return CORNERS.find((corner) => corner === stored) ?? 'bottom-right';
    } catch {
      return 'bottom-right';
    }
  }
}
