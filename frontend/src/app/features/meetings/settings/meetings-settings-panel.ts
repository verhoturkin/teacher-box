import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Message } from 'primeng/message';
import { Tag } from 'primeng/tag';
import { ToggleSwitch } from 'primeng/toggleswitch';
import { quietContext } from '@core/http/api-error.interceptor';
import { HelpButton } from '@features/help/parts';
import { MeetingsApi } from '../data-access/meetings-api';
import { CallsStatus } from '../data-access/meetings.models';
import { MeetingPreferences } from '../telemost';
import { T } from '../i18n/texts';

/**
 * Video meetings: whether the built-in calls are on (ADR-0030), where the external links of students
 * and groups are set, and opening Telemost links in the desktop application on this device.
 */
@Component({
  selector: 'tb-meetings-settings-panel',
  imports: [HelpButton, FormsModule, Message, Tag, ToggleSwitch],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div id="meetings" class="tb-tiles">
      <div class="tb-tile">
        <i class="tb-i tb-i-video_call tb-tile__icon" aria-hidden="true"></i>
        <span class="tb-tile__text">
          <b>{{ t.title }} <tb-help-button topic="teacher/calls" /></b>
          @switch (calls()) {
            @case ('OK') {
              <span>{{ t.on }}</span>
            }
            @case ('OFF') {
              <span>{{ t.off }}</span>
            }
          }
        </span>
        @if (calls() === 'OK') {
          <p-tag severity="success" [value]="t.works" />
        }
      </div>
      <div class="tb-tile">
        <i class="tb-i tb-i-link tb-tile__icon" aria-hidden="true"></i>
        <span class="tb-tile__text">
          <span>{{ t.external }}</span>
        </span>
      </div>
      <label class="tb-tile" for="meetings-open-in-app">
        <span class="tb-tile__text">
          <b>{{ t.openInApp }}</b>
        </span>
        <p-toggleswitch
          inputId="meetings-open-in-app"
          [ngModel]="openInApp()"
          (ngModelChange)="setOpenInApp($event)"
        />
      </label>
    </div>
    @if (calls() === 'UNREACHABLE') {
      <p-message severity="warn" styleClass="tb-form-message">{{ t.unreachable }}</p-message>
    }
  `,
})
export class MeetingsSettingsPanel implements OnInit {
  protected readonly t = T.settings;
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
