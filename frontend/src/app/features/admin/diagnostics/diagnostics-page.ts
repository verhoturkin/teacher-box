import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { HelpButton } from '@features/help/parts';
import { FileSaver } from '@shared/files/file-saver';
import { AdminApi } from '../data-access/admin-api';
import { PageHeader } from '@shared/ui/page-header';
import { T } from '../i18n/texts';

export const ARCHIVE_NAME = 'teacher-box-diagnostics.zip';

/** Administrator: the archive for the developer and what else to send. */
@Component({
  selector: 'tb-diagnostics-page',
  imports: [HelpButton, Button, Card, PageHeader],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <tb-page-header [title]="t.title">
      <tb-help-button help topic="admin/diagnostics" />
    </tb-page-header>
    <div class="tb-stack">
      <p-card>
        <ng-template #title>
          <div class="tb-card-title">
            <span class="tb-card-title__text">{{ t.archive }}</span>
            <div class="tb-card-title__actions">
              <p-button
                [label]="t.download"
                severity="secondary"
                icon="tb-i tb-i-download"
                [loading]="pending()"
                (onClick)="download()"
              />
            </div>
          </div>
        </ng-template>
        <p>{{ t.about }}</p>
      </p-card>
      <p-card [header]="t.send">
        <ol class="tb-send-list">
          <li>{{ t.code }}</li>
          <li>{{ t.steps }}</li>
          <li>{{ t.debug }}</li>
        </ol>
      </p-card>
    </div>
  `,
  styles: `
    .tb-send-list {
      display: flex;
      flex-direction: column;
      gap: var(--tb-space-2);
      margin: 0;
      padding-left: var(--tb-space-5);
    }
  `,
})
export class DiagnosticsPage {
  protected readonly t = T.diagnostics;
  private readonly api = inject(AdminApi);
  private readonly fileSaver = inject(FileSaver);

  protected readonly pending = signal(false);

  download(): void {
    this.pending.set(true);
    this.api.diagnostics().subscribe({
      next: (archive) => {
        this.pending.set(false);
        this.fileSaver.save(archive, ARCHIVE_NAME);
      },
      error: () => {
        this.pending.set(false);
      },
    });
  }
}
