import { ChangeDetectionStrategy, Component } from '@angular/core';
import { BotAbilitiesPanel } from './bot-abilities-panel';
import { BotsPanel } from './bots-panel';
import { StudentMessengersPanel } from './student-messengers-panel';

/**
 * The teacher's messengers (category «Мессенджеры» of the settings, sketch Messengers): only what is common
 * to the portal — the bots with what they can do, and how many students get the notifications. Each
 * student's messengers are in their card; the teacher's own ones and what to send are in «Мой аккаунт».
 */
@Component({
  selector: 'tb-messengers-settings-panel',
  imports: [BotsPanel, BotAbilitiesPanel, StudentMessengersPanel],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="tb-messengers">
      <tb-bots-panel><tb-bot-abilities-panel /></tb-bots-panel>
      <tb-student-messengers-panel />
    </div>
  `,
  styles: `
    /* sketch Messengers: two cards side by side while each gets 360 px, else one under the other */
    .tb-messengers {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(min(22.5rem, 100%), 1fr));
      align-items: start;
      gap: var(--tb-space-4);
    }
  `,
})
export class MessengersSettingsPanel {}
