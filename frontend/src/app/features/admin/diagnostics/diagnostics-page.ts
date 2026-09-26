import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { FileSaver } from '@shared/files/file-saver';
import { AdminApi } from '../data-access/admin-api';

export const ARCHIVE_NAME = 'teacher-box-diagnostics.zip';

/** Administrator: the archive for the developer and what else to send. */
@Component({
  selector: 'tb-diagnostics-page',
  imports: [Button, Card],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 class="tb-page-title">Диагностика</h1>
    <div class="tb-stack">
      <p-card header="Архив для разработчика">
        <p>
          В архиве — последние файлы журнала (до 20 МБ), настройки портала с полностью скрытыми паролями, токенами и
          ключами, состояние и версии. Данных учеников в нём нет, но в журнале могут встречаться логины и
          идентификаторы.
        </p>
        <p-button label="Скачать архив" icon="pi pi-download" [loading]="pending()" (onClick)="download()" />
      </p-card>
      <p-card header="Что отправить вместе с архивом">
        <ol class="tb-send-list">
          <li>Код ошибки из сообщения, которое видел учитель или ученик, и примерное время.</li>
          <li>Что делали перед ошибкой и что ожидали увидеть.</li>
          <li>
            Если ошибку можно повторить — включите на «Журнале» подробный уровень (DEBUG) для нужного раздела, повторите
            действие и скачайте архив снова.
          </li>
        </ol>
      </p-card>
    </div>
  `,
  styles: `
    .tb-send-list {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      margin: 0;
      padding-left: 1.25rem;
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
