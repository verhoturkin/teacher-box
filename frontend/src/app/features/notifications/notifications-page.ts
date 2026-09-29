import {
  ChangeDetectionStrategy,
  Component,
  afterNextRender,
  computed,
  inject,
  input,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { HelpButton } from '@features/help/parts';
import { AuthService } from '@core/auth/auth.service';
import { UnreadNotifications } from '@core/notifications/unread-notifications';
import { ChannelsPanel } from './channels/channels-panel';
import { InboxPanel } from './inbox/inbox-panel';
import { PreferencesPanel } from './preferences/preferences-panel';
import { BotAbilitiesPanel } from './teacher/bot-abilities-panel';
import { BotsPanel } from './teacher/bots-panel';
import { BroadcastsPanel } from './teacher/broadcasts-panel';
import { StudentMessengersPanel } from './teacher/student-messengers-panel';
import { FoldCard } from '@shared/ui/fold-card';
import { PageHeader } from '@shared/ui/page-header';

/** Sections of the teacher's notifications page that fold (`?open=messengers,students`). */
export const FOLDED_SECTIONS = ['messengers', 'students', 'preferences'] as const;
export type FoldedSection = (typeof FOLDED_SECTIONS)[number];

function isFolded(value: unknown): value is FoldedSection {
  return FOLDED_SECTIONS.some((section) => section === value);
}

/**
 * Notifications of the current user; the teacher also manages bots, messages to students and their
 * messengers. The page is a stack of cards in one column (ADR-0021); on the teacher's page the inbox
 * and the messages to students are always open, the settings fold (ADR-0019).
 */
@Component({
  selector: 'tb-notifications-page',
  imports: [
    HelpButton,
    BotAbilitiesPanel,
    BotsPanel,
    BroadcastsPanel,
    ChannelsPanel,
    FoldCard,
    InboxPanel,
    PreferencesPanel,
    StudentMessengersPanel,
    PageHeader,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <tb-page-header title="Уведомления">
      <tb-help-button help [topic]="teacher ? 'teacher/notifications' : 'cabinet/bot'" />
    </tb-page-header>
    @if (teacher) {
      <div class="tb-stack tb-notifications-sections">
        <tb-fold-card
          id="notifications-inbox"
          title="Входящие"
          [collapsible]="false"
          [badge]="unread()"
        >
          <ng-template><tb-inbox-panel /></ng-template>
        </tb-fold-card>
        <tb-fold-card id="notifications-messages" title="Сообщения ученикам" [collapsible]="false">
          <ng-template><tb-broadcasts-panel /></ng-template>
        </tb-fold-card>
        <tb-fold-card
          id="notifications-messengers"
          title="Мессенджеры"
          summary="Боты портала, ваши мессенджеры и что умеет бот"
          [open]="opened().has('messengers')"
          (openChange)="fold('messengers', $event)"
        >
          <ng-template>
            <div class="tb-stack">
              <tb-bots-panel (changed)="reloadChannels()" />
              <tb-channels-panel
                [teacher]="true"
                header="Мои мессенджеры"
                (changed)="reloadBots()"
              />
              <tb-bot-abilities-panel />
            </div>
          </ng-template>
        </tb-fold-card>
        <tb-fold-card
          id="notifications-students"
          title="Ученики"
          summary="Кто из учеников подключил мессенджер, напоминание подключить"
          [single]="true"
          [open]="opened().has('students')"
          (openChange)="fold('students', $event)"
        >
          <ng-template><tb-student-messengers-panel /></ng-template>
        </tb-fold-card>
        <tb-fold-card
          id="notifications-preferences"
          title="Что присылать"
          summary="Какие уведомления дублировать в мессенджеры"
          [single]="true"
          [open]="opened().has('preferences')"
          (openChange)="fold('preferences', $event)"
        >
          <ng-template><tb-preferences-panel [teacher]="true" /></ng-template>
        </tb-fold-card>
      </div>
    } @else {
      <div class="tb-stack tb-notifications-sections">
        <tb-inbox-panel />
        <tb-channels-panel />
        <tb-preferences-panel />
      </div>
    }
  `,
  styles: `
    .tb-notifications-sections {
      max-width: var(--tb-content-narrow);
    }
  `,
})
export class NotificationsPage {
  private readonly router = inject(Router);
  private readonly channels = viewChild(ChannelsPanel);
  private readonly bots = viewChild(BotsPanel);

  /** The open folded sections (query parameter), e.g. `messengers,students`. */
  readonly open = input<string>();
  /** A section of the former tabs (`?tab=messengers`, links of settings and help): opened and shown. */
  readonly tab = input<string>();

  protected readonly teacher = inject(AuthService).user()?.role === 'TEACHER';
  protected readonly unread = inject(UnreadNotifications).count;
  protected readonly opened = computed<ReadonlySet<FoldedSection>>(() => {
    const sections: unknown[] = (this.open() ?? '').split(',');
    sections.push(this.tab());
    return new Set(sections.filter(isFolded));
  });

  constructor() {
    afterNextRender(() => {
      const tab = this.tab();
      const section = tab === undefined ? null : document.getElementById(`notifications-${tab}`);
      if (section !== null && typeof section.scrollIntoView === 'function') {
        section.scrollIntoView({ block: 'start' });
      }
    });
  }

  /** Keeps the open sections in the address; the former `tab` becomes one of them. */
  fold(section: FoldedSection, open: boolean): void {
    const next = new Set(this.opened());
    if (open) {
      next.add(section);
    } else {
      next.delete(section);
    }
    const sections = FOLDED_SECTIONS.filter((name) => next.has(name)).join(',');
    void this.router.navigate([], {
      queryParams: { open: sections === '' ? null : sections, tab: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  reloadChannels(): void {
    this.channels()?.reload();
  }

  reloadBots(): void {
    this.bots()?.reload();
  }
}
