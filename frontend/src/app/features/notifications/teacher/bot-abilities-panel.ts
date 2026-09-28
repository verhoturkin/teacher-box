import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Card } from 'primeng/card';
import { ToggleSwitch } from 'primeng/toggleswitch';
import { NotificationsApi } from '../data-access/notifications-api';
import { BotAbilities } from '../data-access/notifications.models';

/** Teacher: what the bots can do for students and for the teacher; managing the portal through the bot. */
@Component({
  selector: 'tb-bot-abilities-panel',
  imports: [FormsModule, Card, ToggleSwitch],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-card header="Что умеет бот">
      <p class="tb-muted">
        Кроме уведомлений, бот показывает меню действий: напишите ему /menu или нажмите кнопку под
        сообщением. Команды: /menu — меню, /cancel — отменить действие, /help — подсказка, /stop —
        отключить уведомления.
      </p>
      @if (abilities(); as bot) {
        <div class="tb-bot-abilities">
          <div>
            <h3 class="tb-subtitle">Ученикам</h3>
            @if (bot.studentMenu.length === 0) {
              <p class="tb-muted">Пока только уведомления.</p>
            } @else {
              <ul>
                @for (item of bot.studentMenu; track item) {
                  <li>{{ item }}</li>
                }
              </ul>
            }
          </div>
          <div>
            <h3 class="tb-subtitle">Вам</h3>
            @if (bot.teacherMenu.length === 0) {
              <p class="tb-muted">Пока только уведомления.</p>
            } @else {
              <ul>
                @for (item of bot.teacherMenu; track item) {
                  <li>{{ item }}</li>
                }
              </ul>
            }
          </div>
        </div>
        <label class="tb-switch" for="bot-teacher-actions">
          <p-toggleswitch
            inputId="bot-teacher-actions"
            [ngModel]="bot.teacherActions"
            (ngModelChange)="setTeacherActions($event)"
            [disabled]="pending()"
          />
          Управлять порталом через бота (отмечать занятия, записывать оплаты, отвечать на запросы)
        </label>
        <small class="tb-muted">
          Выключите, если к вашему мессенджеру есть доступ у других людей: уведомления продолжат
          приходить, а действия учителя в боте станут недоступны.
        </small>
      }
    </p-card>
  `,
  styles: `
    .tb-bot-abilities {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
      gap: var(--tb-space-4);
      margin-bottom: var(--tb-space-4);

      ul {
        margin: 0;
        padding-inline-start: var(--tb-space-5);
      }
    }
  `,
})
export class BotAbilitiesPanel implements OnInit {
  private readonly api = inject(NotificationsApi);

  protected readonly abilities = signal<BotAbilities | null>(null);
  protected readonly pending = signal(false);

  ngOnInit(): void {
    this.api.botAbilities().subscribe((abilities) => {
      this.abilities.set(abilities);
    });
  }

  setTeacherActions(enabled: boolean): void {
    this.pending.set(true);
    this.api.setTeacherActions(enabled).subscribe({
      next: (abilities) => {
        this.pending.set(false);
        this.abilities.set(abilities);
      },
      error: () => {
        this.pending.set(false);
        // The switch goes back: the saved value has not changed.
        this.abilities.update((abilities) => (abilities === null ? null : { ...abilities }));
      },
    });
  }
}
