import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Card } from 'primeng/card';
import { Message } from 'primeng/message';
import { ToggleSwitch } from 'primeng/toggleswitch';
import { quietContext } from '@core/http/api-error.interceptor';
import { HelpButton } from '@features/help/parts';
import { MeetingsApi } from '../data-access/meetings-api';
import { CallsStatus } from '../data-access/meetings.models';
import { MeetingPreferences } from '../telemost';

/**
 * Video meetings: whether the built-in calls are on (ADR-0030), where the external links of students
 * and groups are set, and opening Telemost links in the desktop application on this device.
 */
@Component({
  selector: 'tb-meetings-settings-panel',
  imports: [HelpButton, FormsModule, RouterLink, Card, Message, ToggleSwitch],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-card id="meetings">
      <ng-template #title>
        <div class="tb-card-title">
          <span class="tb-card-title__text"
            >Видеовстречи <tb-help-button topic="teacher/calls"
          /></span>
        </div>
      </ng-template>
      @switch (calls()) {
        @case ('OK') {
          <p>
            Звонки в портале включены: у каждого ученика и группы своя комната —
            <a class="tb-link" routerLink="/teacher/calls">раздел «Звонки»</a>.
          </p>
        }
        @case ('UNREACHABLE') {
          <p-message severity="warn" styleClass="tb-form-message">
            Звонки в портале включены, но сервер звонков не отвечает. Сообщите администратору
            портала.
          </p-message>
        }
        @case ('OFF') {
          <p>Звонки в портале не настроены — их включает администратор портала.</p>
        }
      }
      <p>
        Вместо комнаты портала у ученика или группы может быть постоянная ссылка на внешнюю
        видеосвязь (Телемост, Zoom и другие): её задают в разделе «Ученики» (строка «Видеовстреча» в
        карточке).
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
export class MeetingsSettingsPanel implements OnInit {
  private readonly api = inject(MeetingsApi);
  private readonly preferences = inject(MeetingPreferences);

  protected readonly openInApp = this.preferences.openInApp;
  /** `null` until known (or when the status could not be read). */
  protected readonly calls = signal<CallsStatus | null>(null);

  ngOnInit(): void {
    this.api.calls(quietContext()).subscribe({
      next: (overview) => {
        this.calls.set(overview.status);
      },
      error: () => undefined,
    });
  }

  setOpenInApp(enabled: boolean): void {
    this.preferences.setOpenInApp(enabled);
  }
}
