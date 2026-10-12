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
import { Router } from '@angular/router';
import { TableModule } from 'primeng/table';
import { HelpButton } from '@features/help/parts';
import { MeetingsSettingsPanel } from '@features/meetings/parts';
import { GoogleCalendarPanel } from '@features/schedule/parts';
import { RowType } from '@shared/ui/row-type.directive';
import { BackupsCard } from './backups/backups-card';
import { DrivePanel } from './backups/drive-panel';
import { SettingsApi } from './data-access/settings-api';
import { PortalSettingsCard } from './portal-settings-card';
import { ResetCard } from './reset-card';
import { FailedDelivery, MessengerType } from './data-access/settings.models';
import { PageHeader } from '@shared/ui/page-header';
import { EmptyState } from '@shared/ui/empty-state';
import { FoldCard } from '@shared/ui/fold-card';
import { T } from './i18n/texts';
import { SHARED_T } from '@shared/i18n/texts';

const MESSENGERS: { readonly type: MessengerType; readonly name: string }[] = [
  { type: 'TELEGRAM', name: 'Telegram' },
  { type: 'VK', name: SHARED_T.messengers.VK },
  { type: 'MAX', name: 'MAX' },
];

/** The sections that fold, in the order of the page (`?open=portal,data`). */
const SECTIONS = ['portal', 'calendar', 'deliveries', 'data'] as const;
type Section = (typeof SECTIONS)[number];

function isSection(value: unknown): value is Section {
  return SECTIONS.some((section) => section === value);
}

/**
 * Teacher: the portal, the calendar and calls, delivery problems, backups and reset.
 * Full width; the sections fold (design system §4), the open ones are in the address; Google's
 * redirect opens the calendar (`?google=...`) or the data with the Drive of the backups (`?drive=...`).
 */
@Component({
  selector: 'tb-settings-page',
  imports: [
    HelpButton,
    DatePipe,
    FoldCard,
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
    <tb-page-header [title]="t.title">
      <tb-help-button help topic="teacher/settings" />
    </tb-page-header>
    <div class="tb-stack">
      <tb-fold-card
        id="settings-portal"
        [title]="t.portal"
        [summary]="t.portalSummary"
        [single]="true"
        [open]="opened().has('portal')"
        (openChange)="fold('portal', $event)"
      >
        <ng-template><tb-portal-settings-card /></ng-template>
      </tb-fold-card>

      <tb-fold-card
        id="settings-calendar"
        [title]="t.calendar"
        [summary]="t.calendarSummary"
        [open]="opened().has('calendar')"
        (openChange)="fold('calendar', $event)"
      >
        <ng-template>
          <div class="tb-stack">
            <tb-google-calendar-panel />
            <tb-meetings-settings-panel />
          </div>
        </ng-template>
      </tb-fold-card>

      <tb-fold-card
        id="settings-deliveries"
        [title]="t.deliveries"
        [summary]="t.deliveriesSummary"
        [badge]="failed().length"
        [open]="opened().has('deliveries')"
        (openChange)="fold('deliveries', $event)"
      >
        <ng-template>
          @if (failed().length === 0) {
            <tb-empty-state icon="pi-check-circle" [title]="t.allDelivered" />
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
                  <td [attr.data-label]="t.when">{{ row.createdAt | date: 'dd.MM.yyyy HH:mm' }}</td>
                  <td [attr.data-label]="t.to">{{ row.recipientName ?? t.you }}</td>
                  <td [attr.data-label]="t.where">{{ messengerName(row) }}</td>
                  <td [attr.data-label]="t.error" class="tb-error-cell tb-cell-wide">
                    {{ row.error ?? '—' }}
                  </td>
                </tr>
              </ng-template>
            </p-table>
          }
        </ng-template>
      </tb-fold-card>

      <tb-fold-card
        id="settings-data"
        [title]="t.data"
        [summary]="t.dataSummary"
        [open]="opened().has('data')"
        (openChange)="fold('data', $event)"
      >
        <ng-template>
          <div class="tb-stack">
            <tb-backups-card />
            <tb-drive-panel />
            <tb-reset-card />
          </div>
        </ng-template>
      </tb-fold-card>
    </div>
  `,
  styles: `
    .tb-error-cell {
      overflow-wrap: anywhere;
    }
  `,
})
export class SettingsPage implements OnInit {
  protected readonly t = T.page;
  private readonly api = inject(SettingsApi);
  private readonly router = inject(Router);

  /** The open sections (query parameter), e.g. `portal,data`. */
  readonly open = input<string>();
  /** The result of Google's redirect: the calendar is open to show it. */
  readonly google = input<string>();
  /** The result of Google's redirect for the Drive of the backups: the data section is open to show it. */
  readonly drive = input<string>();

  protected readonly failed = signal<FailedDelivery[]>([]);
  protected readonly opened = computed<ReadonlySet<Section>>(() => {
    const sections: unknown[] = (this.open() ?? '').split(',');
    if (this.google() !== undefined) {
      sections.push('calendar');
    }
    if (this.drive() !== undefined) {
      sections.push('data');
    }
    return new Set(sections.filter(isSection));
  });

  ngOnInit(): void {
    this.api.notificationsStatus().subscribe((status) => {
      this.failed.set(status.failedDeliveries);
    });
  }

  /** Keeps the open sections in the address. */
  fold(section: Section, open: boolean): void {
    const next = new Set(this.opened());
    if (open) {
      next.add(section);
    } else {
      next.delete(section);
    }
    const sections = SECTIONS.filter((name) => next.has(name)).join(',');
    void this.router.navigate([], {
      queryParams: { open: sections === '' ? null : sections },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  protected messengerName(row: FailedDelivery): string {
    return MESSENGERS.find((messenger) => messenger.type === row.channel)?.name ?? row.channel;
  }
}
