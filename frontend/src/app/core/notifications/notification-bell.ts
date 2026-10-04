import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { ButtonDirective, ButtonIcon } from 'primeng/button';
import { OverlayBadge } from 'primeng/overlaybadge';
import { Tooltip } from 'primeng/tooltip';
import { switchMap, timer } from 'rxjs';
import { UnreadNotifications } from './unread-notifications';

/** How often the unread counter is refreshed. */
export const UNREAD_POLL_INTERVAL_MS = 60_000;

/**
 * Bell with the number of unread notifications; a link to the notifications page (it opens in a new
 * tab too). The badge sits on the corner of the icon button (M3), it does not widen the button.
 */
@Component({
  selector: 'tb-notification-bell',
  imports: [ButtonDirective, ButtonIcon, OverlayBadge, RouterLink, Tooltip],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-overlaybadge [value]="badge()" [badgeDisabled]="badge() === undefined" severity="danger">
      <a
        pButton
        [routerLink]="link()"
        [text]="true"
        [rounded]="true"
        severity="secondary"
        [pTooltip]="label()"
        [attr.aria-label]="label()"
      >
        <i pButtonIcon class="pi pi-bell" aria-hidden="true"></i>
      </a>
    </p-overlaybadge>
  `,
})
export class NotificationBell {
  private readonly unread = inject(UnreadNotifications);

  /** Route of the notifications page. */
  readonly link = input.required<string>();

  protected readonly badge = computed(() => {
    const count = this.unread.count();
    if (count === 0) {
      return undefined;
    }
    return count > 99 ? '99+' : String(count);
  });
  protected readonly label = computed(() => {
    const count = this.unread.count();
    return count === 0 ? 'Уведомления' : `Уведомления, непрочитанных: ${String(count)}`;
  });

  constructor() {
    timer(0, UNREAD_POLL_INTERVAL_MS)
      .pipe(
        switchMap(() => this.unread.refresh()),
        takeUntilDestroyed(),
      )
      .subscribe();
  }
}
