import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { ConfirmationService, MenuItem } from 'primeng/api';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { Menu } from 'primeng/menu';
import { Tooltip } from 'primeng/tooltip';
import { FileSaver } from '@shared/files/file-saver';
import { formatFileSize } from '@shared/files/file-size';
import { HelpButton } from '@features/help/parts';
import type { HelpTopic } from '@features/help/parts';
import { ButtonAttributes } from '@shared/ui/button-attributes';
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
    Menu,
    ButtonAttributes,
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
          <ul class="tb-list" aria-label="Резервные копии">
            @for (backup of backups(); track backup.name) {
              <li>
                <span class="tb-list__lead" aria-hidden="true"><i class="pi pi-database"></i></span>
                <div class="tb-list__text">
                  <span class="tb-list__title">{{
                    backup.createdAt | date: 'dd.MM.yyyy HH:mm'
                  }}</span>
                  <span class="tb-list__supporting">{{ details(backup) }}</span>
                </div>
                <div class="tb-list__trail tb-list__trail--icons">
                  <p-button
                    icon="pi pi-ellipsis-v"
                    [text]="true"
                    [rounded]="true"
                    severity="secondary"
                    [pTooltip]="'Действия: ' + backup.name"
                    [ariaLabel]="'Действия: ' + backup.name"
                    [loading]="busy.is('download-' + backup.name)"
                    [tbAttributes]="{
                      'aria-haspopup': 'menu',
                      'aria-expanded': menuFor()?.name === backup.name ? 'true' : 'false',
                    }"
                    (onClick)="openMenu(backup, $event)"
                  />
                </div>
              </li>
            }
          </ul>
        }
      </tb-load-state>
    </p-card>
    <p-menu
      #menu
      [model]="menuItems()"
      [popup]="true"
      appendTo="body"
      (onHide)="menuFor.set(null)"
    />
    <tb-restore-dialog [(visible)]="restoring" [backup]="selected()" [area]="area()" />
    <p-confirmdialog />
  `,
})
export class BackupsCard implements OnInit {
  protected readonly busy = new Busy();
  private readonly api = inject(BackupsApi);
  private readonly fileSaver = inject(FileSaver);
  private readonly confirmation = inject(ConfirmationService);
  private readonly snackbar = inject(Snackbar);
  private readonly menu = viewChild.required<Menu>('menu');

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

  /** The backup whose «⋮» menu is open: one popup menu serves every row. */
  protected readonly menuFor = signal<BackupInfo | null>(null);
  protected readonly menuItems = computed<MenuItem[]>(() => {
    const backup = this.menuFor();
    return backup === null ? [] : this.actionsOf(backup);
  });

  ngOnInit(): void {
    this.reload();
  }

  /** The supporting line of a row: why the backup was made and its size. */
  protected details(backup: BackupInfo): string {
    const size = formatFileSize(backup.size);
    return backup.kind === null ? size : `${KINDS[backup.kind]} · ${size}`;
  }

  protected openMenu(backup: BackupInfo, event: Event): void {
    this.menuFor.set(backup);
    this.menu().toggle(event);
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

  private actionsOf(backup: BackupInfo): MenuItem[] {
    const items: MenuItem[] = [
      {
        label: 'Восстановить…',
        icon: 'pi pi-history',
        command: () => {
          this.openRestore(backup);
        },
      },
    ];
    if (!this.isAdmin()) {
      items.push(
        {
          label: 'Скачать',
          icon: 'pi pi-download',
          command: () => {
            this.download(backup);
          },
        },
        {
          label: 'Удалить…',
          icon: 'pi pi-trash',
          styleClass: 'tb-menu-item--danger',
          command: () => {
            this.confirmDelete(backup);
          },
        },
      );
    }
    return items;
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
