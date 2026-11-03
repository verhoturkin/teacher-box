import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { Tag } from 'primeng/tag';
import { NotificationsApi } from '../data-access/notifications-api';
import { BotAbilities } from '../data-access/notifications.models';
import { T } from '../i18n/texts';

/**
 * Teacher: what the bots can do for students and for the teacher, folded in the card of the bots (sketch
 * Messengers); allowing teacher actions is in «Мой аккаунт».
 */
@Component({
  selector: 'tb-bot-abilities-panel',
  imports: [Tag],
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
        <ul class="tb-list">
          <li>
            <span class="tb-list__lead" aria-hidden="true"><i class="tb-i tb-i-school"></i></span>
            <div class="tb-list__text">
              <span class="tb-list__title">{{ t.students }}</span>
              <span class="tb-list__supporting">{{ menu(bot.studentMenu) }}</span>
            </div>
          </li>
          <li>
            <span class="tb-list__lead" aria-hidden="true"><i class="tb-i tb-i-person"></i></span>
            <div class="tb-list__text">
              <span class="tb-list__title">{{ t.you }}</span>
              <span class="tb-list__supporting">{{ menu(bot.teacherMenu) }}</span>
            </div>
          </li>
        </ul>
        <h3 class="tb-section-label">{{ t.commandsTitle }}</h3>
        <div class="tb-bot-commands">
          @for (command of t.commands; track command) {
            <p-tag [value]="command" severity="secondary" />
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
    }

    .tb-bot-commands {
      display: flex;
      flex-wrap: wrap;
      gap: var(--tb-space-2);
    }
  `,
})
export class BotAbilitiesPanel implements OnInit {
  protected readonly t = T.abilities;
  private readonly api = inject(NotificationsApi);

  protected readonly abilities = signal<BotAbilities | null>(null);
  protected readonly open = signal(false);

  /** The menu in a line, or that the bot only notifies. */
  protected menu(items: readonly string[]): string {
    return items.length === 0 ? this.t.onlyNotifications : items.join(', ');
  }

  ngOnInit(): void {
    this.api.botAbilities().subscribe((abilities) => {
      this.abilities.set(abilities);
    });
  }
}
