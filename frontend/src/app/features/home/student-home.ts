import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Card } from 'primeng/card';

/** Student personal area dashboard. */
@Component({
  selector: 'tb-student-home',
  imports: [Card],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 class="tb-page-title">Личный кабинет</h1>
    <p-card header="Добро пожаловать!">
      <p>Здесь появятся ваши домашние задания, баланс и уведомления.</p>
    </p-card>
  `,
})
export class StudentHome {}
