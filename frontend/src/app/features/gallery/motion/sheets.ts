import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { Drawer } from 'primeng/drawer';
import { Replay } from '../motion-playback';

/**
 * §1 and §11 Sheets slide in from their edge: the side sheet stands off the edges and may overshoot (in on
 * `--tb-spring-default-spatial`); the bottom sheet sits on the bottom edge and would lift off it (in on
 * `--tb-spring-standard-fast-spatial`). Both leave on the standard fast spring.
 */
@Component({
  selector: 'tb-gallery-sheet-motion',
  imports: [ButtonModule, Drawer, Replay],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <tb-gallery-replay [replay]="false" />
    <div class="tb-gallery-row">
      <p-button label="Side sheet" severity="secondary" (onClick)="side.set(true)" />
      <p-button label="Bottom sheet" severity="secondary" (onClick)="bottom.set(true)" />
    </div>
    <code class="tb-gallery-name"
      >.p-drawer-enter-right: tb-motion-slide-in var(--tb-spring-default-spatial)</code
    >
    <code class="tb-gallery-name"
      >.p-drawer-enter-bottom: tb-motion-slide-in var(--tb-spring-standard-fast-spatial)</code
    >
    <p-drawer
      [visible]="side()"
      (visibleChange)="side.set($event)"
      position="right"
      header="Side sheet"
      styleClass="tb-side-sheet"
    />
    <p-drawer
      [visible]="bottom()"
      (visibleChange)="bottom.set($event)"
      position="bottom"
      header="Bottom sheet"
    />
  `,
})
export class SheetMotionSample {
  protected readonly side = signal(false);
  protected readonly bottom = signal(false);
}
