import { ChangeDetectionStrategy, Component, computed, inject, input, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import { Badge } from 'primeng/badge';
import { Tab, TabList, TabPanel, TabPanels, Tabs } from 'primeng/tabs';
import { AuthService } from '@core/auth/auth.service';
import { UnreadNotifications } from '@core/notifications/unread-notifications';
import { ChannelsPanel } from './channels/channels-panel';
import { InboxPanel } from './inbox/inbox-panel';
import { PreferencesPanel } from './preferences/preferences-panel';
import { BotsPanel } from './teacher/bots-panel';
import { BroadcastsPanel } from './teacher/broadcasts-panel';
import { StudentMessengersPanel } from './teacher/student-messengers-panel';

/** Sections of the teacher's notifications page (`?tab=`). */
export const TEACHER_TABS = ['inbox', 'messages', 'messengers', 'students', 'preferences'] as const;
export type TeacherTab = (typeof TEACHER_TABS)[number];

function isTeacherTab(value: unknown): value is TeacherTab {
  return TEACHER_TABS.some((tab) => tab === value);
}

/** Notifications of the current user; the teacher also manages bots, messages to students and their messengers. */
@Component({
  selector: 'tb-notifications-page',
  imports: [
    Badge,
    Tab,
    TabList,
    TabPanel,
    TabPanels,
    Tabs,
    BotsPanel,
    BroadcastsPanel,
    ChannelsPanel,
    InboxPanel,
    PreferencesPanel,
    StudentMessengersPanel,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 class="tb-page-title">Уведомления</h1>
    @if (teacher) {
      <p-tabs [value]="activeTab()" (valueChange)="select($event)" [lazy]="true" [scrollable]="true">
        <p-tablist>
          <p-tab value="inbox">
            Входящие
            @if (unread() > 0) {
              <p-badge [value]="unread()" />
            }
          </p-tab>
          <p-tab value="messages">Сообщения ученикам</p-tab>
          <p-tab value="messengers">Мессенджеры</p-tab>
          <p-tab value="students">Ученики</p-tab>
          <p-tab value="preferences">Что присылать</p-tab>
        </p-tablist>
        <p-tabpanels>
          <p-tabpanel value="inbox">
            <ng-template #content>
              <tb-inbox-panel />
            </ng-template>
          </p-tabpanel>
          <p-tabpanel value="messages">
            <ng-template #content>
              <tb-broadcasts-panel />
            </ng-template>
          </p-tabpanel>
          <p-tabpanel value="messengers">
            <ng-template #content>
              <div class="tb-stack">
                <tb-bots-panel (changed)="reloadChannels()" />
                <tb-channels-panel [teacher]="true" header="Мои мессенджеры" (changed)="reloadBots()" />
              </div>
            </ng-template>
          </p-tabpanel>
          <p-tabpanel value="students">
            <ng-template #content>
              <tb-student-messengers-panel />
            </ng-template>
          </p-tabpanel>
          <p-tabpanel value="preferences">
            <ng-template #content>
              <tb-preferences-panel [teacher]="true" />
            </ng-template>
          </p-tabpanel>
        </p-tabpanels>
      </p-tabs>
    } @else {
      <div class="tb-notifications-layout">
        <tb-inbox-panel />
        <div class="tb-stack">
          <tb-channels-panel />
          <tb-preferences-panel />
        </div>
      </div>
    }
  `,
  styles: `
    .tb-notifications-layout {
      display: grid;
      grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
      gap: 1rem;
      align-items: start;

      @media (max-width: 900px) {
        grid-template-columns: minmax(0, 1fr);
      }
    }

    p-tabpanels {
      padding-inline: 0;
    }
  `,
})
export class NotificationsPage {
  private readonly router = inject(Router);
  private readonly channels = viewChild(ChannelsPanel);
  private readonly bots = viewChild(BotsPanel);

  /** The open section (query parameter). */
  readonly tab = input<string>();

  protected readonly teacher = inject(AuthService).user()?.role === 'TEACHER';
  protected readonly unread = inject(UnreadNotifications).count;
  protected readonly activeTab = computed<TeacherTab>(() => {
    const tab = this.tab();
    return isTeacherTab(tab) ? tab : 'inbox';
  });

  select(tab: string | number | undefined): void {
    if (isTeacherTab(tab) && tab !== this.activeTab()) {
      void this.router.navigate([], { queryParams: { tab }, replaceUrl: true });
    }
  }

  reloadChannels(): void {
    this.channels()?.reload();
  }

  reloadBots(): void {
    this.bots()?.reload();
  }
}
