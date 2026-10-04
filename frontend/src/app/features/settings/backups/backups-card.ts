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
import { ConfirmationService } from 'primeng/api';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { TableModule } from 'primeng/table';
import { Tag } from 'primeng/tag';
import { Tooltip } from 'primeng/tooltip';
import { FileSaver } from '@shared/files/file-saver';
import { formatFileSize } from '@shared/files/file-size';
import { HelpButton } from '@features/help/parts';
import type { HelpTopic } from '@features/help/parts';
import { RowType } from '@shared/ui/row-type.directive';
import { BackupInfo, BackupKind } from '../data-access/settings.models';
import { BackupsApi, BackupsArea } from './backups-api';
import { RestoreDialog } from './restore-dialog';
import { EmptyState } from '@shared/ui/empty-state';
import { LoadState } from '@shared/ui/load-state';
import { LoadStateView } from '@shared/ui/load-state-view';
import { dangerConfirmation } from '@shared/ui/confirmation';
import { Snackbar } from '@core/snackbar/snackbar';
import { Busy } from '@shared/ui/busy';

const KINDS: Readonly<Record<BackupKind, string>> = {
  SCHEDULED: 'по расписанию',
  MANUAL: 'вручную',
  BEFORE_RESTORE: 'перед восстановлением',
  BEFORE_RESET: 'перед сбросом',
};

/**
 * Backups of the portal (ADR-0014): the teacher creates, downloads, restores and deletes them; the
 * administrator creates and restores them (the backups hold the students' data).
 */
@Component({
  selector: 'tb-backups-card',
  imports: [
    EmptyState,
    DatePipe,
    Button,
    Card,
    ConfirmDialog,
    HelpButton,
    TableModule,
    Tag,
    RowType,
    RestoreDialog,
    Tooltip,
    LoadStateView,
  ],
  providers: [ConfirmationService],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-card id="backups">
      <ng-template #title>
        <div class="tb-card-title">
          <span class="tb-card-title__text"
            >Резервные копии <tb-help-button [topic]="helpTopic()"
          /></span>
          <div class="tb-card-title__actions">
            <p-button
              label="Создать копию сейчас"
              class="tb-tonal"
              severity="success"
              icon="pi pi-database"
              [loading]="creating()"
              (onClick)="create()"
            />
          </div>
        </div>
      </ng-template>
      <p class="tb-muted">
        Копия базы данных и файлов создаётся автоматически каждую ночь; хранятся последние копии.
        Копии, сделанные перед восстановлением и сбросом, остаются, пока их не удалит учитель.
        @if (isAdmin()) {
          Скачать копию может только учитель: в копиях данные учеников.
        }
      </p>
      <tb-load-state [state]="state" what="список копий" (retry)="reload()">
        @if (backups().length === 0) {
          <tb-empty-state icon="pi-database" title="Копий пока нет" />
        } @else {
          <p-table [value]="backups()" styleClass="tb-cards">
            <ng-template #header>
              <tr>
                <th>Создана</th>
                <th>Как</th>
                <th>Размер</th>
                <th></th>
              </tr>
            </ng-template>
            <ng-template #body let-backup [tbRowType]="backups()">
              <tr>
                <td data-label="Создана">{{ backup.createdAt | date: 'dd.MM.yyyy HH:mm' }}</td>
                <td data-label="Как">
                  @if (kind(backup); as label) {
                    <p-tag
                      [value]="label"
                      [severity]="
                        backup.kind === 'SCHEDULED' || backup.kind === 'MANUAL'
                          ? 'secondary'
                          : 'warn'
                      "
                    />
                  }
                </td>
                <td data-label="Размер">{{ size(backup) }}</td>
                <td class="tb-row-actions">
                  <p-button
                    icon="pi pi-history"
                    [text]="true"
                    [pTooltip]="'Восстановить ' + backup.name"
                    [rounded]="true"
                    severity="secondary"
                    [ariaLabel]="'Восстановить ' + backup.name"
                    (onClick)="openRestore(backup)"
                  />
                  @if (!isAdmin()) {
                    <p-button
                      icon="pi pi-download"
                      [text]="true"
                      [pTooltip]="'Скачать ' + backup.name"
                      [rounded]="true"
                      severity="secondary"
                      [ariaLabel]="'Скачать ' + backup.name"
                      [loading]="busy.is('download-' + backup.name)"
                      (onClick)="download(backup)"
                    />
                    <p-button
                      icon="pi pi-trash"
                      [text]="true"
                      [pTooltip]="'Удалить ' + backup.name"
                      [rounded]="true"
                      severity="danger"
                      [ariaLabel]="'Удалить ' + backup.name"
                      (onClick)="confirmDelete(backup)"
                    />
                  }
                </td>
              </tr>
            </ng-template>
          </p-table>
        }
      </tb-load-state>
    </p-card>
    <tb-restore-dialog [(visible)]="restoring" [backup]="selected()" [area]="area()" />
    <p-confirmdialog />
  `,
  styles: `
    .tb-row-actions {
      text-align: right;
      white-space: nowrap;
    }
  `,
})
export class BackupsCard implements OnInit {
  protected readonly busy = new Busy();
  private readonly api = inject(BackupsApi);
  private readonly fileSaver = inject(FileSaver);
  private readonly confirmation = inject(ConfirmationService);
  private readonly snackbar = inject(Snackbar);

  readonly area = input<BackupsArea>('teacher');

  protected readonly isAdmin = computed(() => this.area() === 'admin');
  protected readonly helpTopic = computed<HelpTopic>(() =>
    this.isAdmin() ? 'admin/backups' : 'teacher/backups',
  );
  protected readonly backups = signal<BackupInfo[]>([]);
  protected readonly creating = signal(false);
  protected readonly selected = signal<BackupInfo | null>(null);
  protected readonly restoring = signal(false);
  protected readonly state = new LoadState();

  ngOnInit(): void {
    this.reload();
  }

  protected size(backup: BackupInfo): string {
    return formatFileSize(backup.size);
  }

  protected kind(backup: BackupInfo): string | null {
    return backup.kind === null ? null : KINDS[backup.kind];
  }

  create(): void {
    this.creating.set(true);
    this.api.create(this.area()).subscribe({
      next: (backup) => {
        this.creating.set(false);
        this.snackbar.success(`Копия ${backup.name} создана`);
        this.reload();
      },
      error: () => {
        this.creating.set(false);
      },
    });
  }

  openRestore(backup: BackupInfo): void {
    this.selected.set(backup);
    this.restoring.set(true);
  }

  download(backup: BackupInfo): void {
    this.busy.guard('download-' + backup.name, this.api.download(backup.name)).subscribe((blob) => {
      this.fileSaver.save(blob, backup.name);
    });
  }

  confirmDelete(backup: BackupInfo): void {
    this.confirmation.confirm(
      dangerConfirmation({
        header: 'Удалить копию?',
        message: `Резервная копия ${backup.name} будет удалена без возможности восстановления.`,
        acceptLabel: 'Удалить',
        accept: () => {
          this.api.delete(backup.name).subscribe(() => {
            this.reload();
          });
        },
      }),
    );
  }

  protected reload(): void {
    this.api
      .list(this.area())
      .pipe(this.state.track())
      .subscribe((backups) => {
        this.backups.set(backups);
      });
  }
}
