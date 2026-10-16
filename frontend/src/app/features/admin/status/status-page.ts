import { DatePipe, KeyValuePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { Tag } from 'primeng/tag';
import { formatFileSize } from '@shared/files/file-size';
import { AdminApi } from '../data-access/admin-api';
import { SystemStatus } from '../data-access/admin.models';
import { formatUptime } from '../admin-labels';
import { PortalAddressCard } from './portal-address-card';
import { PageHeader } from '@shared/ui/page-header';
import { HelpButton } from '@features/help/parts';
import { LoadState } from '@shared/ui/load-state';
import { LoadStateView } from '@shared/ui/load-state-view';
import { T } from '../i18n/texts';

/** Administrator: version, uptime, memory, disk, database and health of the instance, the portal address. */
@Component({
  selector: 'tb-status-page',
  imports: [
    DatePipe,
    KeyValuePipe,
    Button,
    Card,
    Tag,
    PortalAddressCard,
    PageHeader,
    HelpButton,
    LoadStateView,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <tb-page-header [title]="t.title">
      <tb-help-button help topic="admin/diagnostics" />
      <p-button
        [label]="t.refresh"
        icon="tb-i tb-i-refresh"
        severity="secondary"
        (onClick)="load()"
      />
    </tb-page-header>
    <tb-load-state [state]="state" [what]="t.what" (retry)="load()">
      @if (status(); as status) {
        <div class="tb-stats">
          <p-card>
            <div class="tb-stat">
              <span class="tb-muted">{{ t.checks }}</span>
              <span class="tb-stat__value">
                <p-tag
                  [value]="status.health"
                  [severity]="status.health === 'UP' ? 'success' : 'danger'"
                />
              </span>
              <small class="tb-muted">
                @for (component of status.components | keyvalue; track component.key) {
                  <span class="tb-component">{{ component.key }}: {{ component.value }}</span>
                }
              </small>
            </div>
          </p-card>
          <p-card>
            <div class="tb-stat">
              <span class="tb-muted">{{ t.version }}</span>
              <span class="tb-stat__value">{{ status.version ?? t.development }}</span>
              @if (status.builtAt !== null) {
                <small class="tb-muted">{{
                  t.built((status.builtAt | date: 'dd.MM.yyyy HH:mm') ?? '')
                }}</small>
              }
              <small class="tb-muted">Java {{ status.javaVersion }}</small>
            </div>
          </p-card>
          <p-card>
            <div class="tb-stat">
              <span class="tb-muted">{{ t.uptime }}</span>
              <span class="tb-stat__value">{{ uptime() }}</span>
              <small class="tb-muted">{{
                t.since((status.startedAt | date: 'dd.MM.yyyy HH:mm') ?? '')
              }}</small>
            </div>
          </p-card>
          <p-card>
            <div class="tb-stat">
              <span class="tb-muted">{{ t.memory }}</span>
              <span class="tb-stat__value">{{ size(status.heapUsed) }}</span>
              <small class="tb-muted">{{ t.of(size(status.heapMax)) }}</small>
            </div>
          </p-card>
          <p-card>
            <div class="tb-stat">
              <span class="tb-muted">{{ t.disk }}</span>
              <span class="tb-stat__value" [class.tb-negative]="lowDisk()">{{
                size(status.diskFree)
              }}</span>
              <small class="tb-muted">{{ t.of(size(status.diskTotal)) }}</small>
              @if (lowDisk()) {
                <p-tag severity="danger" icon="tb-i tb-i-warning" [value]="t.lowDisk" />
              }
            </div>
          </p-card>
          <p-card>
            <div class="tb-stat">
              <span class="tb-muted">{{ t.database }}</span>
              <span class="tb-stat__value">{{ size(status.dataSize) }}</span>
              <small class="tb-muted">{{ t.logs(size(status.logsSize)) }}</small>
            </div>
          </p-card>
        </div>
        <p class="tb-muted tb-status-data">
          {{ t.data(status.dataDir, status.timeZone) }}
        </p>
      }
    </tb-load-state>
    <tb-portal-address-card />
  `,
  styles: `
    .tb-status-data {
      overflow-wrap: anywhere;
    }

    /* a check keeps its name and state on one line */
    .tb-component {
      display: inline-block;
      margin-right: var(--tb-space-3);
      white-space: nowrap;
    }
  `,
})
export class StatusPage implements OnInit {
  protected readonly t = T.status;
  private readonly api = inject(AdminApi);

  protected readonly status = signal<SystemStatus | null>(null);
  protected readonly uptime = computed(() => formatUptime(this.status()?.uptime ?? 0));
  /** Less than 10% free. */
  protected readonly lowDisk = computed(() => {
    const status = this.status();
    return status !== null && status.diskTotal > 0 && status.diskFree / status.diskTotal < 0.1;
  });

  protected readonly state = new LoadState();

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
  }

  protected size(bytes: number): string {
    return formatFileSize(bytes);
  }
}
