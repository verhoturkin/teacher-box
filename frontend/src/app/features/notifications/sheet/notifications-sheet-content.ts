import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Badge } from 'primeng/badge';
import { Tab, TabList, TabPanel, TabPanels, Tabs } from 'primeng/tabs';
import { AuthService } from '@core/auth/auth.service';
import {
  NotificationsSheetState,
  notificationsTab,
} from '@core/notifications/notifications-sheet-state';
import { UnreadNotifications } from '@core/notifications/unread-notifications';
import { InboxPanel } from '../inbox/inbox-panel';
import { BroadcastsPanel } from '../teacher/broadcasts-panel';
import { T } from '../i18n/texts';

/**
 * The content of the bell's side sheet (redesign spec §10.3): for the teacher M3 primary tabs «Входящие N»
 * (`inbox-panel.ts`) and «Отправленные» (`broadcasts-panel.ts`); the student has only the inbox. The frame
 * loads it through `NOTIFICATIONS_SHEET_CONTENT`.
 */
@Component({
  selector: 'tb-notifications-sheet-content',
  imports: [Badge, BroadcastsPanel, InboxPanel, Tab, TabList, TabPanel, TabPanels, Tabs],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (teacher) {
      <p-tabs class="tb-tabs tb-tabs--fixed" [value]="state.tab()" (valueChange)="choose($event)">
        <p-tablist>
          <p-tab value="inbox">
            <span class="tb-tab-label">
              {{ t.inbox }}
              @if (badge(); as count) {
                <p-badge [value]="count" />
              }
            </span>
          </p-tab>
          <p-tab value="sent"
            ><span class="tb-tab-label">{{ t.sent }}</span></p-tab
          >
        </p-tablist>
        <p-tabpanels class="tb-notifications-scroll">
          <p-tabpanel value="inbox"
            ><tb-inbox-panel [inSheet]="true" [headerActive]="state.tab() === 'inbox'"
          /></p-tabpanel>
          <p-tabpanel value="sent"><tb-broadcasts-panel /></p-tabpanel>
        </p-tabpanels>
      </p-tabs>
    } @else {
      <tb-inbox-panel class="tb-notifications-scroll" [inSheet]="true" />
    }
  `,
  styles: `
    /* Portal decision: the sheet heading and tabs stay visible; only tab content scrolls. The sheet has no side
       padding: the tabs and the scrolled content carry the gutter, so the scrollbar sits at the sheet's edge. */
    :host {
      --tb-notifications-gutter: var(--tb-space-6);
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
      overflow: hidden;
    }

    p-tabs {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
      overflow: hidden;
    }

    p-tablist {
      flex: none;
      padding-inline: var(--tb-notifications-gutter);
    }

    p-tabpanel,
    tb-inbox-panel.tb-notifications-scroll {
      padding-inline: var(--tb-notifications-gutter);
    }

    @media (width < 37.5em) {
      :host {
        --tb-notifications-gutter: var(--tb-space-4);
      }
    }

    .tb-notifications-scroll {
      flex: 1;
      min-height: 0;
      overflow-y: auto;
      overscroll-behavior: contain;
    }
  `,
})
export class NotificationsSheetContent {
  protected readonly t = T.sheet;
  protected readonly state = inject(NotificationsSheetState);
  protected readonly teacher = inject(AuthService).user()?.role === 'TEACHER';
  private readonly unread = inject(UnreadNotifications).count;
  /** M3: a tab badge holds at most four characters, «+» included. */
  protected readonly badge = computed(() => {
    const count = this.unread();
    if (count === 0) {
      return null;
    }
    return count > 999 ? '999+' : String(count);
  });

  protected choose(value: string | number | undefined): void {
    this.state.tab.set(notificationsTab(String(value)));
  }
}
