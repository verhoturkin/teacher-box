import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { Badge } from 'primeng/badge';
import { TableModule } from 'primeng/table';
import { pageDetail } from '@core/routing/page-detail';
import { HelpButton } from '@features/help/parts';
import { AccountPanel } from '@features/identity/parts';
import { MeetingsSettingsPanel } from '@features/meetings/parts';
import { GoogleCalendarPanel } from '@features/schedule/parts';
import { RowType } from '@shared/ui/row-type.directive';
import { Pane, Panes, injectListDetail } from '@shared/ui/panes';
import { BackupsCard } from './backups/backups-card';
import { DrivePanel } from './backups/drive-panel';
import { SettingsApi } from './data-access/settings-api';
import { PortalSettingsCard } from './portal-settings-card';
import { ResetCard } from './reset-card';
import { FailedDelivery, MessengerType } from './data-access/settings.models';
import { CATEGORY_ITEMS, CategoryItem, FIRST_CATEGORY, isCategory } from './settings-categories';
import { PageHeader } from '@shared/ui/page-header';
import { EmptyState } from '@shared/ui/empty-state';
import { T } from './i18n/texts';
import { SHARED_T } from '@shared/i18n/texts';

const MESSENGERS: { readonly type: MessengerType; readonly name: string }[] = [
  { type: 'TELEGRAM', name: 'Telegram' },
  { type: 'VK', name: SHARED_T.messengers.VK },
  { type: 'MAX', name: 'MAX' },
];

/**
 * The teacher's settings (redesign spec §10.3): list-detail — the categories in the fixed pane, the chosen
 * one (`/teacher/settings/:category`) beside it. Medium keeps both panes at 50 % each; on compact
 * `/teacher/settings` is the list and a category has «back» to it.
 */
@Component({
  selector: 'tb-settings-page',
  imports: [
    HelpButton,
    DatePipe,
    RouterLink,
    Badge,
    Panes,
    Pane,
    AccountPanel,
    GoogleCalendarPanel,
    MeetingsSettingsPanel,
    PortalSettingsCard,
    BackupsCard,
    DrivePanel,
    ResetCard,
    TableModule,
    RowType,
    PageHeader,
    EmptyState,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <tb-panes medium="two">
      @if (layout.list()) {
        <tb-pane kind="fixed" [label]="t.categories">
          <tb-page-header [title]="t.title">
            <tb-help-button help topic="teacher/settings" />
          </tb-page-header>
          <nav [attr.aria-label]="t.categories">
            <ul class="tb-settings__list">
              @for (item of items; track item.id) {
                <li>
                  <a
                    class="tb-settings__item"
                    [routerLink]="['/teacher/settings', item.id]"
                    [class.tb-settings__current]="isCurrent(item)"
                    [attr.aria-current]="isCurrent(item) ? 'page' : null"
                  >
                    <i class="tb-i tb-settings__icon {{ item.icon }}" aria-hidden="true"></i>
                    <span class="tb-settings__text">
                      <span class="tb-settings__title">{{ item.title }}</span>
                      <span class="tb-settings__summary">{{ item.summary }}</span>
                    </span>
                    @if (item.id === 'messengers' && failed().length > 0) {
                      <p-badge [value]="failed().length" />
                    }
                  </a>
                </li>
              }
            </ul>
          </nav>
        </tb-pane>
      }
      @if (layout.detail()) {
        <tb-pane [label]="current().title">
          @if (layout.single()) {
            <tb-page-header
              [title]="current().title"
              back="/teacher/settings"
              [backLabel]="t.all"
            />
          } @else {
            <h2 class="tb-settings__heading">{{ current().title }}</h2>
          }
          @switch (current().id) {
            @case ('account') {
              <tb-account-panel />
            }
            @case ('portal') {
              <tb-portal-settings-card />
            }
            @case ('calendar') {
              <div class="tb-stack">
                <tb-google-calendar-panel />
                <tb-meetings-settings-panel />
              </div>
            }
            @case ('messengers') {
              <h3 class="tb-settings__subheading">{{ t.deliveries }}</h3>
              @if (failed().length === 0) {
                <tb-empty-state icon="tb-i-check_circle" [title]="t.allDelivered" />
              } @else {
                <p-table [value]="failed()" styleClass="tb-cards">
                  <ng-template #header>
                    <tr>
                      <th>{{ t.when }}</th>
                      <th>{{ t.to }}</th>
                      <th>{{ t.where }}</th>
                      <th>{{ t.error }}</th>
                    </tr>
                  </ng-template>
                  <ng-template #body let-row [tbRowType]="failed()">
                    <tr>
                      <td [attr.data-label]="t.when">
                        {{ row.createdAt | date: 'dd.MM.yyyy HH:mm' }}
                      </td>
                      <td [attr.data-label]="t.to">{{ row.recipientName ?? t.you }}</td>
                      <td [attr.data-label]="t.where">{{ messengerName(row) }}</td>
                      <td [attr.data-label]="t.error" class="tb-error-cell tb-cell-wide">
                        {{ row.error ?? '—' }}
                      </td>
                    </tr>
                  </ng-template>
                </p-table>
              }
            }
            @case ('data') {
              <div class="tb-stack">
                <tb-backups-card />
                <tb-drive-panel />
                <tb-reset-card />
              </div>
            }
          }
        </tb-pane>
      }
    </tb-panes>
  `,
  styles: `
    /*
     * List-detail (redesign spec §10.3): M3 list items with a leading icon, two lines (72 dp); the chosen
     * one is filled with secondary container as the items of the help.
     */
    .tb-settings__list {
      display: flex;
      flex-direction: column;
      gap: var(--tb-space-1);
      margin: var(--tb-space-4) 0 0;
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
      border-radius: var(--tb-shape-lg);
      color: var(--p-md-on-surface);

      &:hover {
        background: color-mix(in srgb, var(--p-md-on-surface) 8%, transparent);
        text-decoration: none;
      }
    }

    .tb-settings__icon {
      flex-shrink: 0;
      color: var(--p-md-on-surface-variant);
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
      color: var(--p-md-on-surface-variant);
      font: var(--tb-type-body-m);
    }

    .tb-settings__current,
    .tb-settings__current:hover {
      background: var(--p-md-secondary-container);
      color: var(--p-md-on-secondary-container);

      .tb-settings__title {
        font: var(--tb-type-title-m-emphasized);
      }

      .tb-settings__icon,
      .tb-settings__summary {
        color: inherit;
      }
    }

    .tb-settings__heading {
      margin: 0 0 var(--tb-space-4);
      font: var(--tb-type-headline-s-emphasized);
    }

    .tb-settings__subheading {
      margin: 0 0 var(--tb-space-3);
      font: var(--tb-type-title-m);
    }

    .tb-error-cell {
      overflow-wrap: anywhere;
    }
  `,
})
export class SettingsPage implements OnInit {
  protected readonly t = T.page;
  protected readonly items = CATEGORY_ITEMS;
  private readonly api = inject(SettingsApi);

  /** Route parameter: the chosen category; none — the list (beside it the first category). */
  readonly category = input<string>();

  protected readonly failed = signal<FailedDelivery[]>([]);
  protected readonly layout = injectListDetail(() => this.category() !== undefined, 'two');
  protected readonly current = computed(() => {
    const category = this.category();
    return (
      CATEGORY_ITEMS.find((item) => isCategory(category) && item.id === category) ?? FIRST_CATEGORY
    );
  });

  constructor() {
    pageDetail(() => (this.layout.detail() ? this.current().title : null));
  }

  ngOnInit(): void {
    this.api.notificationsStatus().subscribe((status) => {
      this.failed.set(status.failedDeliveries);
    });
  }

  protected isCurrent(item: CategoryItem): boolean {
    return this.layout.detail() && item.id === this.current().id;
  }

  protected messengerName(row: FailedDelivery): string {
    return MESSENGERS.find((messenger) => messenger.type === row.channel)?.name ?? row.channel;
  }
}
