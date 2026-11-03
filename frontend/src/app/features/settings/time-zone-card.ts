import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { Message } from 'primeng/message';
import { ScheduleApi } from '@features/schedule/parts';
import { LoadState } from '@shared/ui/load-state';
import { LoadStateView } from '@shared/ui/load-state-view';
import { T } from './i18n/texts';

/**
 * A row of «Время и цена» in the settings category «Занятия» (sketch Lessons): the teacher sees it, the
 * administrator changes it; a device in another zone is told that the portal keeps its own.
 */
@Component({
  selector: 'tb-time-zone-card',
  imports: [Message, LoadStateView],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'tb-flow' },
  template: `
    <tb-load-state [state]="state" [what]="t.timeZoneWhat" [compact]="true" (retry)="load()">
      @if (zone(); as zone) {
        <div id="time-zone" class="tb-tiles">
          <div class="tb-tile">
            <i class="tb-i tb-i-schedule tb-tile__icon" aria-hidden="true"></i>
            <span class="tb-tile__text">
              <b>{{ t.timeZoneTitle }}</b>
              <span>{{ t.timeZone(zone) }} {{ t.timeZoneAdmin }}</span>
            </span>
            <i class="tb-i tb-i-lock" [attr.title]="t.timeZoneAdmin" aria-hidden="true"></i>
          </div>
        </div>
        @if (zone !== browserZone) {
          <p-message severity="info" styleClass="tb-form-message">{{
            t.otherZone(browserZone)
          }}</p-message>
        }
      }
    </tb-load-state>
  `,
})
export class TimeZoneCard implements OnInit {
  protected readonly t = T.page;
  protected readonly browserZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  private readonly api = inject(ScheduleApi);

  protected readonly zone = signal<string | null>(null);
  protected readonly state = new LoadState();

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.api
      .settings()
      .pipe(this.state.track())
      .subscribe((settings) => {
        this.zone.set(settings.timeZone);
      });
  }
}
