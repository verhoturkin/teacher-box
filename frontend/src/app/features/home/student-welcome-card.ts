import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { Portal } from '@core/portal/portal';
import { hideHint, isHintHidden } from '@shared/storage/device-settings';
import { T } from './i18n/texts';

/** Browser storage key: the student hid the welcome card. */
export const WELCOME_DISMISSED_KEY = 'tb.student-welcome.dismissed';

/** Student's home: where things are, until the student hides it. */
@Component({
  selector: 'tb-student-welcome-card',
  imports: [RouterLink, Button, Card],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (!dismissed()) {
      <p-card [header]="t.title(portalName())">
        <p>{{ t.intro }}</p>
        <ul class="tb-welcome">
          <li>
            <a routerLink="/cabinet/schedule" class="tb-link">{{ t.schedule }}</a>
            {{ t.scheduleText }}
          </li>
          <li>
            <a routerLink="/cabinet/homework" class="tb-link">{{ t.homework }}</a>
            {{ t.homeworkText }}
          </li>
          <li>
            <a routerLink="/cabinet/billing" class="tb-link">{{ t.billing }}</a>
            {{ t.billingText }}
          </li>
          <li>
            {{ t.helpBefore }}
            <a routerLink="/cabinet/help" class="tb-link">{{ t.help }}</a> {{ t.helpAfter }}
          </li>
        </ul>
        <div class="tb-widget-footer">
          <span></span>
          <p-button [label]="t.ok" severity="secondary" [text]="true" (onClick)="dismiss()" />
        </div>
      </p-card>
    }
  `,
  styles: `
    .tb-welcome {
      display: flex;
      flex-direction: column;
      gap: var(--tb-space-2);
      margin: 0 0 var(--tb-space-2);
      padding-left: var(--tb-space-5);
    }
  `,
})
export class StudentWelcomeCard {
  protected readonly t = T.welcome;
  protected readonly portalName = inject(Portal).name;
  protected readonly dismissed = signal(isHintHidden(WELCOME_DISMISSED_KEY));

  dismiss(): void {
    hideHint(WELCOME_DISMISSED_KEY);
    this.dismissed.set(true);
  }
}
