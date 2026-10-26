import { PaneHeader } from '@shared/ui/panes';
import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { MenuItem } from 'primeng/api';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { Menu } from 'primeng/menu';
import { Tooltip } from 'primeng/tooltip';
import { FileSaver } from '@shared/files/file-saver';
import { formatFileSize } from '@shared/files/file-size';
import { HelpButton } from '@features/help/parts';
import type { HelpTopic } from '@features/help/parts';
import { ButtonAttributes } from '@shared/ui/button-attributes';
import { BackupInfo, BackupKind } from '../data-access/settings.models';
import { BackupsApi, BackupsArea } from './backups-api';
import { DriveStore } from './drive-store';
import { RestoreDialog } from './restore-dialog';
import { EmptyState } from '@shared/ui/empty-state';
import { LoadState } from '@shared/ui/load-state';
import { LoadStateView } from '@shared/ui/load-state-view';
import { Confirm } from '@shared/ui/confirm';
import { Snackbar } from '@core/snackbar/snackbar';
import { Busy } from '@shared/ui/busy';
import { T } from '../i18n/texts';

const KINDS: Readonly<Record<BackupKind, string>> = T.backups.kinds;

/**
 * Backups of the portal (ADR-0014): the teacher creates, downloads, restores and deletes them; the
 * administrator creates and restores them (the backups hold the students' data).
 */
@Component({
  selector: 'tb-backups-card',
  imports: [
    PaneHeader,
    EmptyState,
    DatePipe,
    Button,
    Card,
    HelpButton,
    Menu,
    ButtonAttributes,
    RestoreDialog,
    Tooltip,
    LoadStateView,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-card id="backups">
      <ng-template #title
        ><ng-template tbPaneHeader>
          <div class="tb-card-title">
            <span class="tb-card-title__text"
              >{{ t.title }} <tb-help-button [topic]="helpTopic()"
            /></span>
            <div class="tb-card-title__actions">
              <p-button
                [label]="t.create"
                severity="secondary"
                icon="tb-i tb-i-database"
                [loading]="creating()"
                (onClick)="create()"
              />
            </div>
          </div> </ng-template
      ></ng-template>
      <p class="tb-muted">
        {{ t.about }}
        @if (isAdmin()) {
          {{ t.teacherOnly }}
        }
      </p>
      <tb-load-state [state]="state" [what]="t.what" (retry)="reload()">
        @if (backups().length === 0) {
          <tb-empty-state icon="tb-i-database" [title]="t.empty" />
        } @else {
          <ul class="tb-list" [attr.aria-label]="t.title">
            @for (backup of backups(); track backup.name) {
              <li>
                <span class="tb-list__lead" aria-hidden="true"
                  ><i class="tb-i tb-i-database"></i
                ></span>
                <div class="tb-list__text">
                  <span class="tb-list__title">{{
                    backup.createdAt | date: 'dd.MM.yyyy HH:mm'
                  }}</span>
                  <span class="tb-list__supporting">{{ details(backup) }}</span>
                </div>
                <div class="tb-list__trail tb-list__trail--icons">
                  <p-button
                    icon="tb-i tb-i-more_vert"
                    [text]="true"
                    [rounded]="true"
                    severity="secondary"
                    [pTooltip]="t.actions(backup.name)"
                    [ariaLabel]="t.actions(backup.name)"
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
  `,
})
export class BackupsCard implements OnInit {
  protected readonly t = T.backups;
  protected readonly busy = new Busy();
  private readonly api = inject(BackupsApi);
  private readonly fileSaver = inject(FileSaver);
  private readonly confirm = inject(Confirm);
  private readonly snackbar = inject(Snackbar);
  private readonly drive = inject(DriveStore);
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

  constructor() {
    // a copy brought from the Google Drive is on the server now
    let arrived = this.drive.arrived();
    effect(() => {
      const now = this.drive.arrived();
      if (now !== arrived) {
        arrived = now;
        untracked(() => {
          this.reload();
        });
      }
    });
  }

  ngOnInit(): void {
    this.reload();
  }

  /** The supporting line of a row: why the backup was made, its size and whether it is in the Drive. */
  protected details(backup: BackupInfo): string {
    const parts = [formatFileSize(backup.size)];
    if (backup.kind !== null) {
      parts.unshift(KINDS[backup.kind]);
    }
    if (this.drive.names().has(backup.name)) {
      parts.push(T.backups.inDrive);
    }
    return parts.join(' · ');
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
        this.snackbar.success(T.backups.created(backup.name));
        this.reload();
        if (this.drive.connected()) {
          this.drive.load(this.area());
        }
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

  sendToDrive(backup: BackupInfo): void {
    this.api.uploadToDrive(backup.name, this.area()).subscribe(() => {
      this.snackbar.success(T.backups.sending(backup.name));
      this.drive.load(this.area());
    });
  }

  async confirmDelete(backup: BackupInfo): Promise<void> {
    if (
      await this.confirm.danger({
        header: T.backups.deleteHeader,
        message: T.backups.deleteMessage(backup.name),
        acceptLabel: T.backups.delete,
      })
    ) {
      this.api.delete(backup.name).subscribe(() => {
        this.reload();
      });
    }
  }

  private actionsOf(backup: BackupInfo): MenuItem[] {
    const items: MenuItem[] = [
      {
        label: T.backups.restore,
        icon: 'tb-i tb-i-history',
        command: () => {
          this.openRestore(backup);
        },
      },
    ];
    if (!this.isAdmin()) {
      items.push({
        label: T.backups.download,
        icon: 'tb-i tb-i-download',
        command: () => {
          this.download(backup);
        },
      });
    }
    if (this.drive.connected()) {
      items.push({
        label: T.backups.sendToDrive,
        icon: 'tb-i tb-i-cloud_upload',
        command: () => {
          this.sendToDrive(backup);
        },
      });
    }
    if (!this.isAdmin()) {
      items.push({
        label: T.backups.deleteItem,
        icon: 'tb-i tb-i-delete',
        styleClass: 'tb-menu-item--danger',
        command: () => {
          void this.confirmDelete(backup);
        },
      });
    }
    return items;
  }

  protected reload(): void {
    this.api
      .list(this.area())
      .pipe(this.state.track())
      .subscribe((backups) => {
        this.backups.set(backups);
        this.drive.local.set(new Set(backups.map((backup) => backup.name)));
      });
  }
}
