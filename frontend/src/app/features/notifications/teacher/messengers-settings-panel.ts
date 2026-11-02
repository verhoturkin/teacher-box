import { ChangeDetectionStrategy, Component } from '@angular/core';
import { BotAbilitiesPanel } from './bot-abilities-panel';
import { BotsPanel } from './bots-panel';
import { StudentMessengersPanel } from './student-messengers-panel';

/**
 * The teacher's messengers (category «Мессенджеры» of the settings, redesign spec §10.3): the portal's bots,
 * what the bot can do and which students connected one (with «Напомнить»). The teacher's own messengers
 * and what to send are in «Мой аккаунт».
 */
@Component({
  selector: 'tb-messengers-settings-panel',
  imports: [BotsPanel, BotAbilitiesPanel, StudentMessengersPanel],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="tb-stack">
      <tb-bots-panel />
      <tb-bot-abilities-panel />
      <tb-student-messengers-panel />
    </div>
  `,
})
export class MessengersSettingsPanel {}
