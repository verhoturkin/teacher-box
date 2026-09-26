import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Card } from 'primeng/card';
import { ConnectMessengerCard } from '@features/notifications';

/** Student personal area dashboard. */
@Component({
  selector: 'tb-student-home',
  imports: [Card, ConnectMessengerCard],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 class="tb-page-title">Личный кабинет</h1>
    <div class="tb-stack">
      <tb-connect-messenger-card />
      <p-card header="Добро пожаловать!">
        <p>Здесь появятся ваши домашние задания, баланс и уведомления.</p>
      </p-card>
    </div>
  `,
})
export class StudentHome {}
