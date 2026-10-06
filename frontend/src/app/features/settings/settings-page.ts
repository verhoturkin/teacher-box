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
import { SettingsApi } from './data-access/settings-api';
import { PortalSettingsCard } from './portal-settings-card';
import { ResetCard } from './reset-card';
import { FailedDelivery, MessengerType } from './data-access/settings.models';
import { PageHeader } from '@shared/ui/page-header';
import { EmptyState } from '@shared/ui/empty-state';
import { FoldCard } from '@shared/ui/fold-card';

const MESSENGERS: { readonly type: MessengerType; readonly name: string }[] = [
  { type: 'TELEGRAM', name: 'Telegram' },
  { type: 'VK', name: 'ВКонтакте' },
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
 * redirect (`?google=...`) opens the calendar.
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
    ResetCard,
    TableModule,
    RowType,
    PageHeader,
    EmptyState,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <tb-page-header title="Настройки">
      <tb-help-button help topic="teacher/settings" />
    </tb-page-header>
    <div class="tb-stack">
      <tb-fold-card
        id="settings-portal"
        title="Портал"
        summary="Название, логотип и цвет портала"
        [single]="true"
        [open]="opened().has('portal')"
        (openChange)="fold('portal', $event)"
      >
        <ng-template><tb-portal-settings-card /></ng-template>
      </tb-fold-card>

      <tb-fold-card
        id="settings-calendar"
        title="Календарь и звонки"
        summary="Google Календарь, видеовстречи и ссылки на занятия"
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
        title="Неудачные доставки"
        summary="Уведомления, которые не дошли до мессенджера"
        [badge]="failed().length"
        [open]="opened().has('deliveries')"
        (openChange)="fold('deliveries', $event)"
      >
        <ng-template>
          @if (failed().length === 0) {
            <tb-empty-state icon="pi-check-circle" title="Все уведомления доставлены" />
          } @else {
            <p-table [value]="failed()" styleClass="tb-cards">
              <ng-template #header>
                <tr>
                  <th>Когда</th>
                  <th>Кому</th>
                  <th>Куда</th>
                  <th>Ошибка</th>
                </tr>
              </ng-template>
              <ng-template #body let-row [tbRowType]="failed()">
                <tr>
                  <td data-label="Когда">{{ row.createdAt | date: 'dd.MM.yyyy HH:mm' }}</td>
                  <td data-label="Кому">{{ row.recipientName ?? 'Вы' }}</td>
                  <td data-label="Куда">{{ messengerName(row) }}</td>
                  <td data-label="Ошибка" class="tb-error-cell tb-cell-wide">
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
        title="Данные"
        summary="Резервные копии, восстановление и полный сброс"
        [open]="opened().has('data')"
        (openChange)="fold('data', $event)"
      >
        <ng-template>
          <div class="tb-stack">
            <tb-backups-card />
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
  private readonly api = inject(SettingsApi);
  private readonly router = inject(Router);

  /** The open sections (query parameter), e.g. `portal,data`. */
  readonly open = input<string>();
  /** The result of Google's redirect: the calendar is open to show it. */
  readonly google = input<string>();

  protected readonly failed = signal<FailedDelivery[]>([]);
  protected readonly opened = computed<ReadonlySet<Section>>(() => {
    const sections: unknown[] = (this.open() ?? '').split(',');
    if (this.google() !== undefined) {
      sections.push('calendar');
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
