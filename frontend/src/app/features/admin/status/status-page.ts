import { DatePipe, KeyValuePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { Button } from 'primeng/button';
import { Tag } from 'primeng/tag';
import { Tooltip } from 'primeng/tooltip';
import { injectWindowSize } from '@core/layout/mobile';
import { BackupsApi } from '@features/settings/parts';
import type { BackupInfo } from '@features/settings/parts';
import { FileSaver } from '@shared/files/file-saver';
import { formatFileSize } from '@shared/files/file-size';
import { HelpButton } from '@features/help/parts';
import { LoadState } from '@shared/ui/load-state';
import { LoadStateView } from '@shared/ui/load-state-view';
import { PageHeader } from '@shared/ui/page-header';
import { Pane, Panes } from '@shared/ui/panes';
import { AdminApi } from '../data-access/admin-api';
import { SystemStatus } from '../data-access/admin.models';
import { formatUptime } from '../admin-labels';
import { T } from '../i18n/texts';
import { PortalAddressCard } from './portal-address-card';

export const ARCHIVE_NAME = 'teacher-box-diagnostics.zip';

/**
 * Administrator: «Состояние» (spec §10.5) — a feed of status tiles in a fixed column order: the services, the
 * queue of events and what to send with a diagnostics archive on the left; the system, the resources, the
 * last backup and the portal address on the right. Narrower than expanded: one column in the same order.
 * The archive is collected from the header.
 */
@Component({
  selector: 'tb-status-page',
  imports: [
    DatePipe,
    KeyValuePipe,
    Button,
    Tag,
    Tooltip,
    RouterLink,
    PortalAddressCard,
    PageHeader,
    HelpButton,
    LoadStateView,
    Pane,
    Panes,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <tb-panes>
      <tb-pane [label]="t.title">
        <tb-page-header tbPaneHeader [title]="t.title">
          <tb-help-button help topic="admin/diagnostics" />
          @if (status(); as status) {
            <span meta class="tb-muted">{{
              t.summary(status.version ?? t.development, uptime())
            }}</span>
          }
          <p-button
            icon="tb-i tb-i-refresh"
            severity="secondary"
            [text]="true"
            [rounded]="true"
            [pTooltip]="t.refresh"
            [ariaLabel]="t.refresh"
            (onClick)="load()"
          />
          <p-button
            [label]="t.collect"
            icon="tb-i tb-i-download"
            severity="secondary"
            [loading]="collecting()"
            (onClick)="collect()"
          />
        </tb-page-header>
        <tb-load-state [state]="state" [what]="t.what" (retry)="load()">
          @if (status(); as status) {
            <div class="tb-feed" [class.tb-feed--2]="twoColumns()">
              <div class="tb-stack tb-feed__lead">
                <section>
                  <h2 class="tb-feed__title">{{ t.services }}</h2>
                  <ul class="tb-list tb-list--no-lead">
                    <li>
                      <div class="tb-list__text">
                        <span class="tb-list__title">{{ t.checks }}</span>
                      </div>
                      <div class="tb-list__trail">
                        <p-tag
                          [value]="status.health"
                          [severity]="status.health === 'UP' ? 'success' : 'danger'"
                        />
                      </div>
                    </li>
                    @for (component of status.components | keyvalue; track component.key) {
                      <li>
                        <div class="tb-list__text">
                          <span class="tb-list__title tb-mono">{{ component.key }}</span>
                        </div>
                        <div class="tb-list__trail">
                          <p-tag
                            [value]="component.value"
                            [severity]="component.value === 'UP' ? 'success' : 'danger'"
                          />
                        </div>
                      </li>
                    }
                  </ul>
                </section>
                <section>
                  <h2 class="tb-feed__title">{{ t.queue }}</h2>
                  <ul class="tb-list tb-list--no-lead">
                    <li>
                      <div class="tb-list__text">
                        <span class="tb-list__title">{{ t.pendingEvents }}</span>
                        @if (events() === 0 && deliveries() === 0) {
                          <span class="tb-list__supporting">{{ t.queueClear }}</span>
                        }
                      </div>
                      <div class="tb-list__trail">{{ events() ?? '—' }}</div>
                    </li>
                    <li>
                      <div class="tb-list__text">
                        <span class="tb-list__title">{{ t.failedDeliveries }}</span>
                      </div>
                      <div class="tb-list__trail">{{ deliveries() ?? '—' }}</div>
                    </li>
                  </ul>
                  @if (queueBusy()) {
                    <p-button
                      class="tb-feed__link"
                      [label]="t.sort"
                      icon="tb-i tb-i-arrow_forward"
                      iconPos="right"
                      [text]="true"
                      routerLink="/admin/logs"
                      [queryParams]="{ view: 'events' }"
                    />
                  }
                </section>
                <section>
                  <h2 class="tb-feed__title">{{ t.diagnostics }}</h2>
                  <p class="tb-muted tb-feed__about">{{ d.about }}</p>
                  <h3 class="tb-feed__subtitle">{{ d.send }}</h3>
                  <ol class="tb-send-list">
                    <li>{{ d.code }}</li>
                    <li>{{ d.steps }}</li>
                    <li>{{ d.debug }}</li>
                  </ol>
                </section>
              </div>
              <div class="tb-stack tb-feed__side">
                <section>
                  <h2 class="tb-feed__title">{{ t.system }}</h2>
                  <ul class="tb-list tb-list--no-lead">
                    <li>
                      <div class="tb-list__text">
                        <span class="tb-list__title">{{ t.version }}</span>
                        <span class="tb-list__supporting"
                          >{{
                            status.builtAt === null
                              ? ''
                              : t.built((status.builtAt | date: 'dd.MM.yyyy HH:mm') ?? '') + ' · '
                          }}Java {{ status.javaVersion }}</span
                        >
                      </div>
                      <div class="tb-list__trail">{{ status.version ?? t.development }}</div>
                    </li>
                    <li>
                      <div class="tb-list__text">
                        <span class="tb-list__title">{{ t.uptime }}</span>
                        <span class="tb-list__supporting">{{
                          t.since((status.startedAt | date: 'dd.MM.yyyy HH:mm') ?? '')
                        }}</span>
                      </div>
                      <div class="tb-list__trail">{{ uptime() }}</div>
                    </li>
                  </ul>
                </section>
                <section>
                  <h2 class="tb-feed__title">{{ t.resources }}</h2>
                  <ul class="tb-list tb-list--no-lead">
                    <li>
                      <div class="tb-list__text">
                        <span class="tb-list__title">{{ t.memory }}</span>
                        <span class="tb-list__supporting">{{ t.of(size(status.heapMax)) }}</span>
                      </div>
                      <div class="tb-list__trail">{{ size(status.heapUsed) }}</div>
                    </li>
                    <li>
                      <div class="tb-list__text">
                        <span class="tb-list__title">{{ t.disk }}</span>
                        <span class="tb-list__supporting">{{ t.of(size(status.diskTotal)) }}</span>
                        @if (lowDisk()) {
                          <p-tag severity="danger" icon="tb-i tb-i-warning" [value]="t.lowDisk" />
                        }
                      </div>
                      <div class="tb-list__trail" [class.tb-negative]="lowDisk()">
                        {{ size(status.diskFree) }}
                      </div>
                    </li>
                    <li>
                      <div class="tb-list__text">
                        <span class="tb-list__title">{{ t.database }}</span>
                        <span class="tb-list__supporting">{{ t.logs(size(status.logsSize)) }}</span>
                      </div>
                      <div class="tb-list__trail">{{ size(status.dataSize) }}</div>
                    </li>
                  </ul>
                  <p class="tb-muted tb-feed__data">
                    {{ t.data(status.dataDir, status.timeZone) }}
                  </p>
                </section>
                <section>
                  <h2 class="tb-feed__title">{{ t.lastBackup }}</h2>
                  <ul class="tb-list tb-list--no-lead">
                    <li>
                      <div class="tb-list__text">
                        @if (lastBackup(); as backup) {
                          <a class="tb-list__title tb-list__link" routerLink="/admin/backups">{{
                            backup.createdAt | date: 'dd.MM.yyyy HH:mm'
                          }}</a>
                          <span class="tb-list__supporting">{{ size(backup.size) }}</span>
                        } @else {
                          <a class="tb-list__title tb-list__link" routerLink="/admin/backups">{{
                            t.noBackup
                          }}</a>
                        }
                      </div>
                    </li>
                  </ul>
                </section>
                <tb-portal-address-card />
              </div>
            </div>
          }
        </tb-load-state>
      </tb-pane>
    </tb-panes>
  `,
  styles: `
    .tb-feed {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      gap: var(--tb-space-6) var(--tb-space-8);
      align-items: start;
    }

    .tb-feed--2 {
      grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr);
    }

    .tb-feed__title {
      margin: 0 0 var(--tb-space-3);
      font: var(--tb-type-title-m);
    }

    .tb-feed__subtitle {
      margin: var(--tb-space-4) 0 var(--tb-space-2);
      font: var(--tb-type-label-l);
    }

    .tb-feed__about,
    .tb-feed__data {
      margin: var(--tb-space-3) 0 0;
      overflow-wrap: anywhere;
    }

    .tb-mono {
      font-family: var(--tb-font-mono);
    }

    .tb-send-list {
      display: flex;
      flex-direction: column;
      gap: var(--tb-space-2);
      margin: 0;
      padding-left: var(--tb-space-5);
    }
  `,
})
export class StatusPage implements OnInit {
  protected readonly t = T.status;
  protected readonly d = T.diagnostics;
  private readonly api = inject(AdminApi);
  private readonly backups = inject(BackupsApi);
  private readonly fileSaver = inject(FileSaver);
  private readonly windowSize = injectWindowSize();

  protected readonly status = signal<SystemStatus | null>(null);
  /** Unprocessed events and failed deliveries; `null` — not known (the request failed). */
  protected readonly events = signal<number | null>(null);
  protected readonly deliveries = signal<number | null>(null);
  protected readonly lastBackup = signal<BackupInfo | null>(null);
  protected readonly collecting = signal(false);
  protected readonly state = new LoadState();

  protected readonly twoColumns = computed(() => {
    const size = this.windowSize();
    return size !== 'compact' && size !== 'medium';
  });
  protected readonly uptime = computed(() => formatUptime(this.status()?.uptime ?? 0));
  protected readonly queueBusy = computed(
    () => (this.events() ?? 0) + (this.deliveries() ?? 0) > 0,
  );
  /** Less than 10% free. */
  protected readonly lowDisk = computed(() => {
    const status = this.status();
    return status !== null && status.diskTotal > 0 && status.diskFree / status.diskTotal < 0.1;
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.api
      .status()
      .pipe(this.state.track())
      .subscribe((status) => {
        this.status.set(status);
      });
    this.api.events().subscribe({
      next: (events) => {
        this.events.set(events.length);
      },
      error: () => {
        this.events.set(null);
      },
    });
    this.api.failedDeliveries().subscribe({
      next: (deliveries) => {
        this.deliveries.set(deliveries.length);
      },
      error: () => {
        this.deliveries.set(null);
      },
    });
    this.backups.list('admin').subscribe({
      next: (list) => {
        this.lastBackup.set(
          list.reduce<BackupInfo | null>(
            (latest, backup) =>
              latest === null || backup.createdAt > latest.createdAt ? backup : latest,
            null,
          ),
        );
      },
      error: () => {
        this.lastBackup.set(null);
      },
    });
  }

  /** Downloads the archive for the developer. */
  collect(): void {
    this.collecting.set(true);
    this.api.diagnostics().subscribe({
      next: (archive) => {
        this.collecting.set(false);
        this.fileSaver.save(archive, ARCHIVE_NAME);
      },
      error: () => {
        this.collecting.set(false);
      },
    });
  }

  protected size(bytes: number): string {
    return formatFileSize(bytes);
  }
}
