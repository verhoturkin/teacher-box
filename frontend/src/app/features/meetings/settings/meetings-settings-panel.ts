import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Card } from 'primeng/card';
import { ToggleSwitch } from 'primeng/toggleswitch';
import { HelpButton } from '@features/help/parts';
import { MeetingPreferences } from '../telemost';

/**
 * Video meetings: where the links of students and groups are set, and opening Telemost links in
 * the desktop application on this device.
 */
@Component({
  selector: 'tb-meetings-settings-panel',
  imports: [HelpButton, FormsModule, Card, ToggleSwitch],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-card id="meetings">
      <ng-template #title>
        <div class="tb-card-title">
          <span class="tb-card-title__text"
            >Видеовстречи <tb-help-button topic="teacher/meetings"
          /></span>
        </div>
      </ng-template>
      <p>
        У каждого ученика и у каждой группы может быть постоянная ссылка на внешнюю видеосвязь
        (Телемост, Zoom и другие): её задают в разделе «Ученики» (строка «Видеовстреча» в карточке).
      </p>
      <label class="tb-switch" for="meetings-open-in-app">
        <p-toggleswitch
          inputId="meetings-open-in-app"
          [ngModel]="openInApp()"
          (ngModelChange)="setOpenInApp($event)"
        />
        Открывать встречи Телемоста в приложении на этом компьютере
      </label>
    </p-card>
  `,
})
export class MeetingsSettingsPanel {
  private readonly preferences = inject(MeetingPreferences);

  protected readonly openInApp = this.preferences.openInApp;

  setOpenInApp(enabled: boolean): void {
    this.preferences.setOpenInApp(enabled);
  }
}
