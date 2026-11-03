import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Message } from 'primeng/message';
import { Tag } from 'primeng/tag';
import { ToggleSwitch } from 'primeng/toggleswitch';
import { quietContext } from '@core/http/api-error.interceptor';
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
  imports: [FormsModule, Message, Tag, ToggleSwitch],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'tb-flow' },
  template: `
    <div id="meetings" class="tb-tiles">
      <div class="tb-tile">
        <i class="tb-i tb-i-video_call tb-tile__icon" aria-hidden="true"></i>
        <span class="tb-tile__text">
          <b>{{ t.title }}</b>
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
          <b>{{ t.external }}</b>
          <span>{{ t.externalHint }}</span>
        </span>
      </div>
      <label class="tb-tile" for="meetings-open-in-app">
        <i class="tb-i tb-i-open_in_new tb-tile__icon" aria-hidden="true"></i>
        <span class="tb-tile__text">
          <b>{{ t.openInApp }}</b>
          <span>{{ t.thisDevice }}</span>
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
    } @else {
      <p-message severity="info" icon="tb-i tb-i-info" styleClass="tb-form-message">{{
        t.admin
      }}</p-message>
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
