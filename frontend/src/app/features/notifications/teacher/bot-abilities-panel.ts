import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { NotificationsApi } from '../data-access/notifications-api';
import { BotAbilities } from '../data-access/notifications.models';
import { T } from '../i18n/texts';

/**
 * Teacher: what the bots can do for students and for the teacher, folded in the card of the bots (sketch
 * Messengers); allowing teacher actions is in «Мой аккаунт».
 */
@Component({
  selector: 'tb-bot-abilities-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: block' },
  template: `
    <ul class="tb-list">
      <li>
        <span class="tb-list__lead" aria-hidden="true"><i class="tb-i tb-i-smart_toy"></i></span>
        <div class="tb-list__text">
          <button
            type="button"
            class="tb-list__title tb-list__link"
            aria-controls="tb-bot-abilities"
            [attr.aria-expanded]="open()"
            (click)="open.set(!open())"
          >
            {{ t.title }}
          </button>
          <span class="tb-list__supporting">{{ t.summary }}</span>
        </div>
        <div class="tb-list__trail" aria-hidden="true">
          <i class="tb-i" [class.tb-i-expand_more]="!open()" [class.tb-i-expand_less]="open()"></i>
        </div>
      </li>
    </ul>
    <div id="tb-bot-abilities" class="tb-bot-abilities" [hidden]="!open()">
      <p class="tb-muted">{{ t.about }}</p>
      @if (abilities(); as bot) {
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
      }
    </div>
  `,
  styles: `
    .tb-list__link {
      border: 0;
      padding: 0;
      background: none;
      color: inherit;
      text-align: start;
      cursor: pointer;
    }

    .tb-bot-abilities:not([hidden]) {
      display: flex;
      flex-direction: column;
      gap: var(--tb-space-4);
      padding: var(--tb-space-4) var(--tb-space-4) 0;

      p {
        margin: 0;
      }

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
  protected readonly open = signal(false);

  ngOnInit(): void {
    this.api.botAbilities().subscribe((abilities) => {
      this.abilities.set(abilities);
    });
  }
}
