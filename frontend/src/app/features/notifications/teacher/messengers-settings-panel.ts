import { ChangeDetectionStrategy, Component, viewChild } from '@angular/core';
import { ChannelsPanel } from '../channels/channels-panel';
import { PreferencesPanel } from '../preferences/preferences-panel';
import { BotAbilitiesPanel } from './bot-abilities-panel';
import { BotsPanel } from './bots-panel';
import { StudentMessengersPanel } from './student-messengers-panel';
import { T } from '../i18n/texts';

/**
 * The teacher's messengers (category «Мессенджеры» of the settings, redesign spec §10.3): the portal's bots,
 * own messengers, what the bot can do, which students connected one (with «Напомнить») and what to send.
 * A bot linked or a messenger connected reloads the other list: both show the same link.
 */
@Component({
  selector: 'tb-messengers-settings-panel',
  imports: [BotsPanel, ChannelsPanel, BotAbilitiesPanel, StudentMessengersPanel, PreferencesPanel],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="tb-stack">
      <tb-bots-panel (changed)="reloadChannels()" />
      <tb-channels-panel [teacher]="true" [header]="t.myMessengers" (changed)="reloadBots()" />
      <tb-bot-abilities-panel />
      <tb-student-messengers-panel />
      <tb-preferences-panel [teacher]="true" />
    </div>
  `,
})
export class MessengersSettingsPanel {
  protected readonly t = T.page;
  private readonly channels = viewChild(ChannelsPanel);
  private readonly bots = viewChild(BotsPanel);

  reloadChannels(): void {
    this.channels()?.reload();
  }

  reloadBots(): void {
    this.bots()?.reload();
  }
}
