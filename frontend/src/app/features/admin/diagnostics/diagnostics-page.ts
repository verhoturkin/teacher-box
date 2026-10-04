import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { HelpButton } from '@features/help/parts';
import { FileSaver } from '@shared/files/file-saver';
import { AdminApi } from '../data-access/admin-api';
import { PageHeader } from '@shared/ui/page-header';

export const ARCHIVE_NAME = 'teacher-box-diagnostics.zip';

/** Administrator: the archive for the developer and what else to send. */
@Component({
  selector: 'tb-diagnostics-page',
  imports: [HelpButton, Button, Card, PageHeader],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <tb-page-header title="Диагностика">
      <tb-help-button help topic="admin/diagnostics" />
    </tb-page-header>
    <div class="tb-stack">
      <p-card>
        <ng-template #title>
          <div class="tb-card-title">
            <span class="tb-card-title__text">Архив для разработчика</span>
            <div class="tb-card-title__actions">
              <p-button
                label="Скачать архив"
                severity="secondary"
                icon="pi pi-download"
                [loading]="pending()"
                (onClick)="download()"
              />
            </div>
          </div>
        </ng-template>
        <p>
          В архиве — последние файлы журнала (до 20 МБ), настройки портала с полностью скрытыми
          паролями, токенами и ключами, состояние и версии. Данных учеников в нём нет, но в журнале
          могут встречаться логины и идентификаторы.
        </p>
      </p-card>
      <p-card header="Что отправить вместе с архивом">
        <ol class="tb-send-list">
          <li>Код ошибки из сообщения, которое видел учитель или ученик, и примерное время.</li>
          <li>Что делали перед ошибкой и что ожидали увидеть.</li>
          <li>
            Если ошибку можно повторить — включите на «Журнале» подробный уровень (DEBUG) для
            нужного раздела, повторите действие и скачайте архив снова.
          </li>
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
