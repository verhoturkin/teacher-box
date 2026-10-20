import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ButtonDirective, ButtonIcon } from 'primeng/button';
import { OverlayBadge } from 'primeng/overlaybadge';
import { Tooltip } from 'primeng/tooltip';
import { switchMap, timer } from 'rxjs';
import { CORE_T } from '@core/i18n/texts';
import { NotificationsSheetState } from './notifications-sheet-state';
import { UnreadNotifications } from './unread-notifications';

/** How often the unread counter is refreshed. */
export const UNREAD_POLL_INTERVAL_MS = 60_000;

/**
 * Bell with the number of unread notifications; it opens and closes the notifications side sheet
 * (`tb-notifications-sheet`, redesign spec §10.3). The badge sits on the icon inside the button, without an
 * outline (M3); it does not widen the button.
 */
@Component({
  selector: 'tb-notification-bell',
  imports: [ButtonDirective, ButtonIcon, OverlayBadge, Tooltip],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-overlaybadge [value]="badge()" [badgeDisabled]="badge() === undefined" severity="danger">
      <button
        pButton
        type="button"
        [text]="true"
        [rounded]="true"
        severity="secondary"
        [pTooltip]="label()"
        [attr.aria-label]="label()"
        aria-controls="tb-notifications-sheet"
        [attr.aria-expanded]="sheet.open()"
        (click)="sheet.toggle()"
      >
        <i pButtonIcon class="tb-i tb-i-notifications" aria-hidden="true"></i>
      </button>
    </p-overlaybadge>
  `,
})
export class NotificationBell {
  private readonly unread = inject(UnreadNotifications);

  protected readonly sheet = inject(NotificationsSheetState);

  protected readonly badge = computed(() => {
    const count = this.unread.count();
    if (count === 0) {
      return undefined;
    }
    return count > 99 ? '99+' : String(count);
  });
  protected readonly label = computed(() => {
    const count = this.unread.count();
    return count === 0 ? CORE_T.bell.notifications : CORE_T.bell.unread(count);
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
