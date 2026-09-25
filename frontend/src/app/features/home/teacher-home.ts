import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Card } from 'primeng/card';

/** Teacher dashboard. Widgets of the subsystems are added as they are implemented. */
@Component({
  selector: 'tb-teacher-home',
  imports: [Card],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 class="tb-page-title">Главная</h1>
    <p-card header="Добро пожаловать в Teacher Box">
      <p>Здесь появятся сводка по ученикам, оплатам и домашним заданиям.</p>
    </p-card>
  `,
})
export class TeacherHome {}
