import { DatePipe, KeyValuePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { Tag } from 'primeng/tag';
import { formatFileSize } from '@shared/files/file-size';
import { AdminApi } from '../data-access/admin-api';
import { SystemStatus } from '../data-access/admin.models';
import { formatUptime } from '../admin-labels';

/** Administrator: version, uptime, memory, disk, database and health of the instance. */
@Component({
  selector: 'tb-status-page',
  imports: [DatePipe, KeyValuePipe, Button, Card, Tag],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="tb-page-header">
      <h1 class="tb-page-title">Состояние</h1>
      <p-button label="Обновить" icon="pi pi-refresh" [outlined]="true" (onClick)="load()" />
    </div>
    @if (status(); as status) {
      <div class="tb-stats">
        <p-card>
          <div class="tb-stat">
            <span class="tb-muted">Проверки</span>
            <span class="tb-stat__value">
              <p-tag [value]="status.health" [severity]="status.health === 'UP' ? 'success' : 'danger'" />
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
            <span class="tb-muted">Версия</span>
            <span class="tb-stat__value">{{ status.version ?? 'разработка' }}</span>
            @if (status.builtAt !== null) {
              <small class="tb-muted">сборка {{ status.builtAt | date: 'dd.MM.yyyy HH:mm' }}</small>
            }
            <small class="tb-muted">Java {{ status.javaVersion }}</small>
          </div>
        </p-card>
        <p-card>
          <div class="tb-stat">
            <span class="tb-muted">Работает</span>
            <span class="tb-stat__value">{{ uptime() }}</span>
            <small class="tb-muted">с {{ status.startedAt | date: 'dd.MM.yyyy HH:mm' }}</small>
          </div>
        </p-card>
        <p-card>
          <div class="tb-stat">
            <span class="tb-muted">Память</span>
            <span class="tb-stat__value">{{ size(status.heapUsed) }}</span>
            <small class="tb-muted">из {{ size(status.heapMax) }}</small>
          </div>
        </p-card>
        <p-card>
          <div class="tb-stat">
            <span class="tb-muted">Свободно на диске</span>
            <span class="tb-stat__value" [class.tb-negative]="lowDisk()">{{ size(status.diskFree) }}</span>
            <small class="tb-muted">из {{ size(status.diskTotal) }}</small>
          </div>
        </p-card>
        <p-card>
          <div class="tb-stat">
            <span class="tb-muted">База данных</span>
            <span class="tb-stat__value">{{ size(status.dataSize) }}</span>
            <small class="tb-muted">журналы: {{ size(status.logsSize) }}</small>
          </div>
        </p-card>
      </div>
      <p class="tb-muted">Данные: {{ status.dataDir }} · часовой пояс {{ status.timeZone }}</p>
    }
  `,
  styles: `
    .tb-component {
      margin-right: 0.75rem;
    }
  `,
})
export class StatusPage implements OnInit {
  private readonly api = inject(AdminApi);

  protected readonly status = signal<SystemStatus | null>(null);
  protected readonly uptime = computed(() => formatUptime(this.status()?.uptime ?? 0));
  /** Less than 10% free. */
  protected readonly lowDisk = computed(() => {
    const status = this.status();
    return status !== null && status.diskTotal > 0 && status.diskFree / status.diskTotal < 0.1;
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.api.status().subscribe((status) => {
      this.status.set(status);
    });
  }

  protected size(bytes: number): string {
    return formatFileSize(bytes);
  }
}
