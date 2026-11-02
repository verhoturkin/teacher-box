import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Tag } from 'primeng/tag';
import { AuthService } from '@core/auth/auth.service';
import { injectWindowSize } from '@core/layout/mobile';
import { CanLeave } from '@core/routing/can-leave.guard';
import { pageDetail } from '@core/routing/page-detail';
import { UnsavedChanges } from '@core/routing/unsaved-changes';
import { HelpButton } from '@features/help/parts';
import { AiApi, AiSettingsPanel } from '@features/ai/parts';
import { DefaultPriceCard } from '@features/billing/parts';
import { AccountPanel } from '@features/identity/parts';
import { MeetingsSettingsPanel } from '@features/meetings/parts';
import { MessengersSettingsPanel } from '@features/notifications/parts';
import { CalendarFeedPanel, GoogleCalendarPanel } from '@features/schedule/parts';
import { SHARED_T } from '@shared/i18n/texts';
import { Confirm } from '@shared/ui/confirm';
import { Avatar } from '@shared/ui/avatar';
import { Pane, Panes } from '@shared/ui/panes';
import { BackupsApi } from './backups/backups-api';
import { BackupsCard } from './backups/backups-card';
import { DrivePanel } from './backups/drive-panel';
import { SettingsApi } from './data-access/settings-api';
import { PortalSettingsCard } from './portal-settings-card';
import { ResetCard } from './reset-card';
import { TimeZoneCard } from './time-zone-card';
import { FailedDeliveriesCard } from './failed-deliveries-card';
import { FailedDelivery, NotificationsStatus } from './data-access/settings.models';
import {
  CATEGORY_ITEMS,
  CategoryItem,
  FIRST_CATEGORY,
  SettingsCategory,
  aiState,
  dataState,
  isCategory,
  messengersState,
} from './settings-categories';
import { PageHeader } from '@shared/ui/page-header';
import { T } from './i18n/texts';

/**
 * The teacher's settings in six categories (sketches Main, TabletSettings, PhoneSettings): from medium the
 * list of the categories with their states and the chosen one (`/teacher/settings/:category`) beside it in
 * one pane; on compact `/teacher/settings` is the list (the account leads) and a category has «back» to it.
 */
@Component({
  selector: 'tb-settings-page',
  imports: [
    HelpButton,
    NgTemplateOutlet,
    RouterLink,
    Tag,
    Avatar,
    Panes,
    Pane,
    AccountPanel,
    TimeZoneCard,
    GoogleCalendarPanel,
    CalendarFeedPanel,
    MeetingsSettingsPanel,
    MessengersSettingsPanel,
    FailedDeliveriesCard,
    DefaultPriceCard,
    AiSettingsPanel,
    PortalSettingsCard,
    BackupsCard,
    DrivePanel,
    ResetCard,
    PageHeader,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <tb-panes>
      <tb-pane [label]="compact() && !open() ? t.categories : current().title">
        @if (compact() && open()) {
          <tb-page-header
            tbPaneHeader
            [title]="current().title"
            back="/teacher/settings"
            [backLabel]="t.all"
          />
        } @else {
          <tb-page-header tbPaneHeader [title]="t.title">
            @if (!compact() && !medium() && current().id !== 'portal') {
              <span help class="tb-settings__saved">
                <i class="tb-i tb-i-cloud_done" aria-hidden="true"></i>{{ t.savedAtOnce }}
              </span>
            }
            <tb-help-button help topic="teacher/settings" />
          </tb-page-header>
        }
        @if (!compact()) {
          <div class="tb-settings__cols">
            <nav
              class="tb-settings__nav"
              [class.tb-settings__nav--medium]="medium()"
              [attr.aria-label]="t.categories"
            >
              <ul class="tb-settings__list">
                @for (item of items; track item.id) {
                  <li>
                    <a
                      class="tb-settings__item"
                      [routerLink]="['/teacher/settings', item.id]"
                      [class.tb-settings__current]="item.id === current().id"
                      [attr.aria-current]="item.id === current().id ? 'page' : null"
                    >
                      <i class="tb-i tb-settings__icon {{ item.icon }}" aria-hidden="true"></i>
                      <span class="tb-settings__text">
                        <span class="tb-settings__title">{{ item.title }}</span>
                        @if (!medium()) {
                          <span class="tb-settings__summary">{{ summary(item) }}</span>
                        }
                      </span>
                      <ng-container *ngTemplateOutlet="badge; context: { $implicit: item }" />
                    </a>
                  </li>
                }
              </ul>
            </nav>
            <div class="tb-settings__detail">
              <ng-container *ngTemplateOutlet="detail" />
            </div>
          </div>
        } @else if (open()) {
          <ng-container *ngTemplateOutlet="detail" />
        } @else {
          <!-- the phone (sketch PhoneSettings): the account leads, the portal's categories follow -->
          <nav [attr.aria-label]="t.categories">
            @if (user(); as user) {
              <ul class="tb-settings__list">
                <li>
                  <a class="tb-settings__item" routerLink="/teacher/settings/account">
                    <tb-avatar [name]="user.displayName" [photo]="user.avatar" />
                    <span class="tb-settings__text">
                      <span class="tb-settings__title">{{ user.displayName }}</span>
                      <span class="tb-settings__summary">{{ t.accountLead }}</span>
                    </span>
                    <i class="tb-i tb-i-chevron_right" aria-hidden="true"></i>
                  </a>
                </li>
              </ul>
            }
            <h2 class="tb-settings__group">{{ t.portal }}</h2>
            <ul class="tb-settings__list">
              @for (item of portalItems; track item.id) {
                <li>
                  <a class="tb-settings__item" [routerLink]="['/teacher/settings', item.id]">
                    <i class="tb-i tb-settings__icon {{ item.icon }}" aria-hidden="true"></i>
                    <span class="tb-settings__text">
                      <span class="tb-settings__title">
                        {{ item.id === 'portal' ? t.portalAppearance : item.title }}
                      </span>
                      <span class="tb-settings__summary">{{ summary(item) }}</span>
                    </span>
                    <ng-container *ngTemplateOutlet="badge; context: { $implicit: item }" />
                    <i class="tb-i tb-i-chevron_right" aria-hidden="true"></i>
                  </a>
                </li>
              }
            </ul>
          </nav>
        }
      </tb-pane>
    </tb-panes>

    <ng-template #badge let-item>
      @if (item.id === 'messengers' && failed().length > 0) {
        <p-tag severity="danger" [value]="'' + failed().length" />
      }
    </ng-template>

    <ng-template #detail>
      @switch (current().id) {
        @case ('account') {
          <div class="tb-stack">
            <tb-account-panel />
          </div>
        }
        @case ('portal') {
          <tb-portal-settings-card />
        }
        @case ('lessons') {
          <!-- stacked as before the merge; «Время и цена» comes in 357.2 -->
          <div class="tb-stack">
            <tb-time-zone-card />
            <tb-default-price-card />
            <tb-google-calendar-panel />
            <tb-calendar-feed-panel />
            <tb-meetings-settings-panel />
          </div>
        }
        @case ('messengers') {
          <!-- a problem first: the badge of the category leads to it -->
          <div class="tb-stack">
            @if (failed().length > 0) {
              <tb-failed-deliveries-card [deliveries]="failed()" />
            }
            <tb-messengers-settings-panel />
            @if (failed().length === 0) {
              <tb-failed-deliveries-card [deliveries]="failed()" />
            }
          </div>
        }
        @case ('ai') {
          <tb-ai-settings-panel />
        }
        @case ('data') {
          <div class="tb-stack">
            <tb-backups-card />
            <tb-drive-panel />
            <tb-reset-card />
          </div>
        }
      }
    </ng-template>
  `,
  styles: `
    /*
     * The sketches Main, TabletSettings and PhoneSettings: from medium one pane holds the list of the
     * categories and the chosen one beside it; on a phone the list and a category are screens of their own.
     */
    .tb-settings__cols {
      display: flex;
      gap: var(--tb-space-6);
      align-items: flex-start;
    }

    /* the sketch: 280–320 px on expanded, 212 px of one-line rows on medium */
    .tb-settings__nav {
      flex: 1 1 17.5rem;
      max-width: 20rem;
    }

    .tb-settings__nav--medium {
      flex: 0 0 13.25rem;
    }

    .tb-settings__detail {
      flex: 999 1 0;
      min-width: 0;
    }

    .tb-settings__saved {
      display: inline-flex;
      flex: 1;
      align-items: center;
      gap: var(--tb-space-1);
      margin-inline-start: var(--tb-space-3);
      color: var(--p-md-on-surface-variant);
      font: var(--tb-type-body-m);

      .tb-i {
        font-size: 1.125rem;
      }
    }

    /* M3 list items with a leading icon, two lines; the chosen one is filled with secondary container */
    .tb-settings__list {
      display: flex;
      flex-direction: column;
      gap: 2px;
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .tb-settings__item {
      display: flex;
      align-items: center;
      gap: var(--tb-space-4);
      min-block-size: 4.5rem;
      box-sizing: border-box;
      padding: var(--tb-space-2) var(--tb-space-4);
      border-radius: var(--tb-list-inner);
      background: var(--tb-list-item);
      color: var(--p-md-on-surface);

      &:hover {
        background: color-mix(
          in srgb,
          var(--p-md-on-surface) var(--tb-state-hover),
          var(--tb-list-item)
        );
        text-decoration: none;
      }

      > .tb-i-chevron_right {
        color: var(--p-md-on-surface-variant);
        font-size: 1.5rem;
      }
    }

    /* the segmented list (M3E): the group's outer corners are large, the rows between are 4 px */
    li:first-child .tb-settings__item {
      border-start-start-radius: var(--tb-list-outer);
      border-start-end-radius: var(--tb-list-outer);
    }

    li:last-child .tb-settings__item {
      border-end-start-radius: var(--tb-list-outer);
      border-end-end-radius: var(--tb-list-outer);
    }

    /* the icon in a tonal circle (the sketch); ours: 40 px, secondary container */
    .tb-settings__icon {
      display: inline-flex;
      flex-shrink: 0;
      align-items: center;
      justify-content: center;
      width: 2.5rem;
      height: 2.5rem;
      border-radius: var(--tb-shape-full);
      background: var(--p-md-secondary-container);
      color: var(--p-md-on-secondary-container);
      font-size: 1.5rem;
    }

    .tb-settings__text {
      display: flex;
      flex: 1;
      flex-direction: column;
      min-width: 0;
    }

    .tb-settings__title {
      font: var(--tb-type-title-m);
    }

    .tb-settings__summary {
      overflow: hidden;
      color: var(--p-md-on-surface-variant);
      font: var(--tb-type-body-m);
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .tb-settings__current,
    .tb-settings__current:hover {
      background: var(--p-md-secondary-container);
      color: var(--p-md-on-secondary-container);

      .tb-settings__title {
        font: var(--tb-type-title-m-emphasized);
      }

      .tb-settings__icon {
        background: var(--p-md-surface);
      }

      .tb-settings__summary {
        color: inherit;
      }
    }

    /* medium (TabletSettings): one-line rows (M3 56 dp), the icon without its circle */
    .tb-settings__nav--medium {
      .tb-settings__item {
        gap: var(--tb-space-3);
        min-block-size: 3.5rem;
        padding: var(--tb-space-3);
      }

      .tb-settings__icon,
      .tb-settings__current .tb-settings__icon {
        width: auto;
        height: auto;
        background: none;
        color: inherit;
        font-size: 1.25rem;
      }

      .tb-settings__title {
        font: var(--tb-type-label-l);
      }

      .tb-settings__current .tb-settings__title {
        font: var(--tb-type-label-l-emphasized);
      }
    }

    /* the label of the portal's group on a phone */
    .tb-settings__group {
      margin: var(--tb-space-4) 0 var(--tb-space-2);
      color: var(--p-md-on-surface-variant);
      font: var(--tb-type-label-l);
    }
  `,
})
export class SettingsPage implements OnInit, CanLeave {
  protected readonly t = T.page;
  protected readonly items = CATEGORY_ITEMS;
  protected readonly portalItems = CATEGORY_ITEMS.filter((item) => item.id !== 'account');
  private readonly api = inject(SettingsApi);
  private readonly aiApi = inject(AiApi);
  private readonly backupsApi = inject(BackupsApi);
  private readonly confirm = inject(Confirm);
  private readonly unsaved = inject(UnsavedChanges);
  protected readonly user = inject(AuthService).user;

  /** Route parameter: the chosen category; none — the list (beside it the first category). */
  readonly category = input<string>();

  private readonly size = injectWindowSize();
  protected readonly compact = computed(() => this.size() === 'compact');
  protected readonly medium = computed(() => this.size() === 'medium');
  protected readonly open = computed(() => this.category() !== undefined);
  protected readonly failed = signal<FailedDelivery[]>([]);
  private readonly messengers = signal<NotificationsStatus | null>(null);
  /** The states of the categories once loaded; until then the summary says what a category holds. */
  private readonly states = signal<Partial<Record<SettingsCategory, string>>>({});
  protected readonly current = computed(() => {
    const category = this.category();
    return (
      CATEGORY_ITEMS.find((item) => isCategory(category) && item.id === category) ?? FIRST_CATEGORY
    );
  });

  constructor() {
    pageDetail(() => (!this.compact() || this.open() ? this.current().title : null));
  }

  ngOnInit(): void {
    this.api.notificationsStatus().subscribe((status) => {
      this.failed.set(status.failedDeliveries);
      this.messengers.set(status);
    });
    this.aiApi.status(true).subscribe((status) => {
      this.states.update((states) => ({ ...states, ai: aiState(status) }));
    });
    this.backupsApi.list('teacher').subscribe((backups) => {
      this.states.update((states) => ({ ...states, data: dataState(backups) }));
    });
  }

  /** Only the portal's appearance waits for «Сохранить»; the rest saves on change (sketch Changes). */
  canLeave(): boolean | Promise<boolean> {
    if (this.current().id !== 'portal' || !this.unsaved.dirty()) {
      return true;
    }
    return this.confirm.danger({
      header: SHARED_T.dialog.discardTitle,
      message: SHARED_T.dialog.discardText,
      acceptLabel: SHARED_T.dialog.discard,
    });
  }

  /** The state under the category's name; on a phone failed deliveries take its place (PhoneSettings). */
  protected summary(item: CategoryItem): string {
    if (item.id !== 'messengers') {
      return this.states()[item.id] ?? item.summary;
    }
    const status = this.messengers();
    if (status === null) {
      return item.summary;
    }
    const failed = status.failedDeliveries.length;
    return this.compact() && failed > 0 ? this.t.notDelivered(failed) : messengersState(status);
  }
}
