import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { Button } from 'primeng/button';
import { switchMap, timer } from 'rxjs';
import { UnreadNotifications } from './unread-notifications';

/** How often the unread counter is refreshed. */
export const UNREAD_POLL_INTERVAL_MS = 60_000;

/** Bell with the number of unread notifications; opens the notifications page. */
@Component({
  selector: 'tb-notification-bell',
  imports: [Button],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-button
      icon="pi pi-bell"
      [text]="true"
      [rounded]="true"
      severity="secondary"
      [badge]="badge()"
      badgeSeverity="danger"
      [ariaLabel]="label()"
      (onClick)="open()"
    />
  `,
})
export class NotificationBell {
  private readonly unread = inject(UnreadNotifications);
  private readonly router = inject(Router);

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

  open(): void {
    void this.router.navigateByUrl(this.link());
  }
}
