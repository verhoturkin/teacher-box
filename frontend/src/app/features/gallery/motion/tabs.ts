import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Tab, TabList, Tabs } from 'primeng/tabs';
import { TabIndicator } from '@shared/ui/tab-indicator';
import { Replay } from '../motion-playback';

/**
 * §11 The tab indicator (413.1): one per bar, it slides to the label of the chosen tab and takes its width on the
 * slow spatial spring, the leading edge 50 ms ahead — scrollable tabs (the cards) and fixed ones (the bell).
 */
@Component({
  selector: 'tb-gallery-tab-motion',
  imports: [Replay, Tabs, TabIndicator, TabList, Tab],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <tb-gallery-replay [replay]="false" />
    <div class="tb-gallery-cell">
      <p-tabs tbTabIndicator class="tb-tabs" value="overview" [scrollable]="true">
        <p-tablist>
          @for (tab of scrollable; track tab) {
            <p-tab [value]="tab"
              ><span class="tb-tab-label">{{ tab }}</span></p-tab
            >
          }
        </p-tablist>
      </p-tabs>
      <code class="tb-gallery-name">.tb-tabs — left / right on --tb-spring-slow-spatial</code>
    </div>
    <div class="tb-gallery-cell">
      <p-tabs tbTabIndicator class="tb-tabs tb-tabs--fixed" value="inbox">
        <p-tablist>
          <p-tab value="inbox"><span class="tb-tab-label">Inbox</span></p-tab>
          <p-tab value="sent"><span class="tb-tab-label">Sent broadcasts</span></p-tab>
        </p-tablist>
      </p-tabs>
      <code class="tb-gallery-name">.tb-tabs.tb-tabs--fixed</code>
    </div>
  `,
})
export class TabMotionSample {
  protected readonly scrollable = ['overview', 'lessons', 'tasks', 'payments', 'profile'];
}
