import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { WebPush } from '@core/push/web-push';
import { Snackbar } from '@core/snackbar/snackbar';
import { hideHint, isHintHidden } from '@shared/storage/device-settings';
import { Busy } from '@shared/ui/busy';
import { T } from '../i18n/texts';

/** Browser storage key: the user postponed turning on notifications on this device. */
export const PUSH_DISMISSED_KEY = 'tb.push.dismissed';

/**
 * The home page: offers notifications on this device (ADR-0051) until they are on, the browser blocks
 * them or the user says «Не сейчас». In an iPhone tab it explains «Добавьте на экран Домой» instead.
 */
@Component({
  selector: 'tb-push-onboarding-card',
  imports: [Button, Card],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (visible()) {
      <p-card [header]="push.needsHomeScreen ? t.homeScreenTitle : t.title">
        <p>{{ push.needsHomeScreen ? p.homeScreen : teacher() ? t.teacher : t.student }}</p>
        <div class="tb-actions">
          @if (push.needsHomeScreen) {
            <p-button [label]="t.ok" severity="secondary" (onClick)="dismiss()" />
          } @else {
            <p-button
              [label]="t.enable"
              icon="tb-i tb-i-notifications"
              [loading]="busy.is('enable')"
              (onClick)="enable()"
            />
            <p-button [label]="t.later" severity="secondary" [text]="true" (onClick)="dismiss()" />
          }
        </div>
      </p-card>
    }
  `,
})
export class PushOnboardingCard implements OnInit {
  protected readonly t = T.pushCard;
  protected readonly p = T.push;
  protected readonly push = inject(WebPush);
  protected readonly busy = new Busy();
  private readonly snackbar = inject(Snackbar);
  private readonly dismissed = signal(isHintHidden(PUSH_DISMISSED_KEY));

  /** The teacher's text names what the teacher gets. */
  readonly teacher = input(false);

  protected readonly visible = computed(
    () =>
      !this.dismissed() &&
      (this.push.needsHomeScreen ||
        (this.push.supported &&
          !this.push.denied() &&
          this.push.devices() !== null &&
          !this.push.enabledHere())),
  );

  ngOnInit(): void {
    if (!this.dismissed() && (this.push.supported || this.push.needsHomeScreen)) {
      this.push.load();
    }
  }

  enable(): void {
    this.busy.guard('enable', this.push.enable()).subscribe({
      next: () => {
        this.snackbar.success(this.p.enabled);
      },
      error: () => {
        this.snackbar.error(this.push.denied() ? this.p.denied : this.p.failed);
      },
    });
  }

  dismiss(): void {
    hideHint(PUSH_DISMISSED_KEY);
    this.dismissed.set(true);
  }
}
