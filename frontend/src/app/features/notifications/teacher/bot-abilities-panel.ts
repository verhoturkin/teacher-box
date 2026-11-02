import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { Card } from 'primeng/card';
import { NotificationsApi } from '../data-access/notifications-api';
import { BotAbilities } from '../data-access/notifications.models';
import { T } from '../i18n/texts';

/** Teacher: what the bots can do for students and for the teacher (allowing teacher actions is in «Мой аккаунт»). */
@Component({
  selector: 'tb-bot-abilities-panel',
  imports: [Card],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-card [header]="t.title">
      <p class="tb-muted">{{ t.about }}</p>
      @if (abilities(); as bot) {
        <div class="tb-bot-abilities">
          <div>
            <h3 class="tb-subtitle">{{ t.students }}</h3>
            @if (bot.studentMenu.length === 0) {
              <p class="tb-muted">{{ t.onlyNotifications }}</p>
            } @else {
              <ul>
                @for (item of bot.studentMenu; track item) {
                  <li>{{ item }}</li>
                }
              </ul>
            }
          </div>
          <div>
            <h3 class="tb-subtitle">{{ t.you }}</h3>
            @if (bot.teacherMenu.length === 0) {
              <p class="tb-muted">{{ t.onlyNotifications }}</p>
            } @else {
              <ul>
                @for (item of bot.teacherMenu; track item) {
                  <li>{{ item }}</li>
                }
              </ul>
            }
          </div>
        </div>
      }
    </p-card>
  `,
  styles: `
    .tb-bot-abilities {
      display: flex;
      flex-direction: column;
      gap: var(--tb-space-4);

      ul {
        margin: 0;
        padding-inline-start: var(--tb-space-5);
      }
    }
  `,
})
export class BotAbilitiesPanel implements OnInit {
  protected readonly t = T.abilities;
  private readonly api = inject(NotificationsApi);

  protected readonly abilities = signal<BotAbilities | null>(null);

  ngOnInit(): void {
    this.api.botAbilities().subscribe((abilities) => {
      this.abilities.set(abilities);
    });
  }
}
