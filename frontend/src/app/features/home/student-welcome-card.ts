import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { Portal } from '@core/portal/portal';
import { hideHint, isHintHidden } from '@shared/storage/device-settings';

/** Browser storage key: the student hid the welcome card. */
export const WELCOME_DISMISSED_KEY = 'tb.student-welcome.dismissed';

/** Student's home: where things are, until the student hides it. */
@Component({
  selector: 'tb-student-welcome-card',
  imports: [RouterLink, Button, Card],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (!dismissed()) {
      <p-card [header]="'Добро пожаловать в «' + portalName() + '»!'">
        <p>Здесь всё, что нужно для занятий:</p>
        <ul class="tb-welcome">
          <li>
            <a routerLink="/cabinet/schedule" class="tb-link">Расписание</a> — ваши занятия, ссылка
            на урок, отмена и перенос.
          </li>
          <li>
            <a routerLink="/cabinet/homework" class="tb-link">Задания</a> — домашние задания и
            ответы учителя.
          </li>
          <li>
            <a routerLink="/cabinet/billing" class="tb-link">Оплаты</a> — баланс и история оплат.
          </li>
          <li>
            Если что-то непонятно, откройте
            <a routerLink="/cabinet/help" class="tb-link">справку</a> — там всё по шагам.
          </li>
        </ul>
        <div class="tb-widget-footer">
          <span></span>
          <p-button
            label="Понятно"
            severity="secondary"
            size="small"
            [text]="true"
            (onClick)="dismiss()"
          />
        </div>
      </p-card>
    }
  `,
  styles: `
    .tb-welcome {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      margin: 0 0 0.5rem;
      padding-left: 1.25rem;
    }
  `,
})
export class StudentWelcomeCard {
  protected readonly portalName = inject(Portal).name;
  protected readonly dismissed = signal(isHintHidden(WELCOME_DISMISSED_KEY));

  dismiss(): void {
    hideHint(WELCOME_DISMISSED_KEY);
    this.dismissed.set(true);
  }
}
