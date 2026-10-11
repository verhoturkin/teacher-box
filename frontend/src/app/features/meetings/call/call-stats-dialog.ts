import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  output,
  signal,
} from '@angular/core';
import { Button } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { CallStats } from './call-engine';
import { CallSession } from './call-session';
import { statsSections } from './call-stats';
import { T } from '../i18n/texts';
import { SHARED_T } from '@shared/i18n/texts';

/** How often the details are read again, ms. */
export const STATS_INTERVAL = 2000;

/**
 * «Сведения о связи»: the connection quality of everyone, how this browser reaches the media server
 * (UDP or TCP, directly or through TURN, ports, round trip), received and sent sound and video. Read
 * again every two seconds while open — for finding why the sound stutters.
 */
@Component({
  selector: 'tb-call-stats-dialog',
  imports: [Button, Dialog],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-dialog
      [header]="t.title"
      [visible]="true"
      [modal]="true"
      [draggable]="false"
      [closeOnEscape]="true"
      appendTo="body"
      styleClass="tb-dialog tb-call-stats"
      (visibleChange)="closed.emit()"
    >
      @for (section of sections(); track section.title) {
        <h3 class="tb-call-stats__title">{{ section.title }}</h3>
        <dl class="tb-call-stats__list">
          @for (row of section.rows; track $index) {
            <dt>{{ row.label }}</dt>
            <dd>{{ row.value }}</dd>
          }
        </dl>
      }
      @if (sections().length < 2) {
        <p class="tb-muted" role="status">{{ t.later }}</p>
      }
      <ng-template #footer>
        <p-button [label]="c.close" severity="secondary" [text]="true" (onClick)="closed.emit()" />
      </ng-template>
    </p-dialog>
  `,
})
export class CallStatsDialog {
  protected readonly c = SHARED_T.common;
  protected readonly t = T.stats;
  private readonly session = inject(CallSession);

  readonly closed = output();

  protected readonly stats = signal<CallStats | null>(null);
  protected readonly sections = computed(() =>
    statsSections(this.stats(), this.session.participants()),
  );

  constructor() {
    void this.read();
    const timer = setInterval(() => {
      void this.read();
    }, STATS_INTERVAL);
    inject(DestroyRef).onDestroy(() => {
      clearInterval(timer);
    });
  }

  private async read(): Promise<void> {
    this.stats.set(await this.session.stats());
  }
}
