import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { Card } from 'primeng/card';
import { Message } from 'primeng/message';
import { ScheduleApi } from '@features/schedule/parts';
import { LoadState } from '@shared/ui/load-state';
import { LoadStateView } from '@shared/ui/load-state-view';
import { T } from './i18n/texts';

/**
 * The time zone of the portal in «Расписание и календарь» (redesign spec §10.3): the teacher sees it, the
 * administrator changes it; a device in another zone is told that the portal keeps its own.
 */
@Component({
  selector: 'tb-time-zone-card',
  imports: [Card, Message, LoadStateView],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-card id="time-zone" [header]="t.timeZoneTitle">
      <tb-load-state [state]="state" [what]="t.timeZoneWhat" [compact]="true" (retry)="load()">
        @if (zone(); as zone) {
          <p>{{ t.timeZone(zone) }}</p>
          <p class="tb-muted">{{ t.timeZoneAdmin }}</p>
          @if (zone !== browserZone) {
            <p-message severity="info" styleClass="tb-form-message">{{
              t.otherZone(browserZone)
            }}</p-message>
          }
        }
      </tb-load-state>
    </p-card>
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
