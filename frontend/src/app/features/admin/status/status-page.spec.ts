import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { eventPublication, failedDelivery, systemStatus } from '@testing/admin-fixtures';
import { portalSettings } from '@testing/portal-fixtures';
import { buttonByText, hostElement, readableText } from '@testing/dom';
import { FileSaver } from '@shared/files/file-saver';
import type { BackupInfo } from '@features/settings/parts';
import { EventPublication, FailedDelivery, SystemStatus } from '../data-access/admin.models';
import { ARCHIVE_NAME, StatusPage } from './status-page';
import { screenWidth, testProviders } from '@testing/setup';

const BACKUP: BackupInfo = {
  name: 'teacher-box-2026-09-26.zip',
  size: 2 * 1024 * 1024,
  createdAt: '2026-09-26T03:00:00Z',
  kind: 'SCHEDULED',
  version: '1.1.0',
};

describe('StatusPage', () => {
  let fixture: ComponentFixture<StatusPage>;
  let backend: HttpTestingController;
  let save: ReturnType<typeof vi.fn>;

  function create(width = 1600): void {
    save = vi.fn();
    TestBed.configureTestingModule({
      imports: [StatusPage],
      providers: testProviders(screenWidth(width), { provide: FileSaver, useValue: { save } }),
    });
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(StatusPage);
    fixture.detectChanges();
  }

  async function answer(
    status: SystemStatus,
    events: EventPublication[] = [],
    deliveries: FailedDelivery[] = [],
    backups: BackupInfo[] = [],
  ): Promise<void> {
    backend.expectOne('/api/admin/status').flush(status);
    backend.expectOne('/api/admin/events').flush(events);
    backend.expectOne('/api/admin/notifications/deliveries').flush(deliveries);
    backend.expectOne('/api/admin/backups').flush(backups);
    fixture.detectChanges();
    await fixture.whenStable();
  }

  /** The address card asks for the portal once the status is shown. */
  function answerPortal(): void {
    backend.match('/api/admin/portal').forEach((request) => {
      request.flush(portalSettings());
    });
  }

  async function render(status: SystemStatus, backups: BackupInfo[] = []): Promise<void> {
    create();
    await answer(status, [], [], backups);
    answerPortal();
  }

  afterEach(() => {
    fixture.destroy();
    backend.verify();
  });

  it('shows a failed load with «Повторить»', async () => {
    create();
    backend.expectOne('/api/admin/status').flush(null, { status: 503, statusText: 'Down' });
    backend.expectOne('/api/admin/events').flush([]);
    backend.expectOne('/api/admin/notifications/deliveries').flush([]);
    backend.expectOne('/api/admin/backups').flush([]);
    await fixture.whenStable();

    expect(readableText(hostElement(fixture))).toContain('Не удалось загрузить состояние портала');

    buttonByText(hostElement(fixture), 'Повторить').click();
    await answer(systemStatus());
    answerPortal();

    expect(readableText(hostElement(fixture))).toContain('Версия 1.1.0');
  });

  it('shows the services, the system, the resources and the last backup in two columns', async () => {
    await render(systemStatus(), [
      BACKUP,
      { ...BACKUP, name: 'old.zip', createdAt: '2026-09-20T03:00:00Z' },
    ]);

    const text = readableText(hostElement(fixture));
    expect(text).toContain('Проверки UP');
    expect(text).toContain('db UP');
    expect(text).toContain('diskSpace UP');
    expect(text).toContain('Версия 1.1.0 · работает 2 д 3 ч');
    expect(text).toContain('с 24.09.2026');
    expect(text).toContain('из 512 МБ 100 МБ');
    expect(text).toContain('из 100 ГБ 20 ГБ');
    expect(text).toContain('журналы: 1 МБ 5 МБ');
    expect(text).toContain('Данные: /data · часовой пояс Europe/Moscow');
    expect(text).toContain('Последняя копия 26.09.2026');
    expect(text).toContain('Всё обработано');
    expect(text).toContain('Код ошибки из сообщения');
    expect(hostElement(fixture).querySelector('.tb-negative')).toBeNull();
    expect(hostElement(fixture).querySelector('.tb-feed--2')).not.toBeNull();
  });

  it('puts the feed into one column on a phone', async () => {
    create(599);
    await answer(systemStatus());
    answerPortal();

    expect(hostElement(fixture).querySelector('.tb-feed--2')).toBeNull();
    expect(readableText(hostElement(fixture))).toContain('Копий ещё нет');
  });

  it('warns about a full disk and a failed check, and refreshes', async () => {
    await render(
      systemStatus({ version: null, builtAt: null, health: 'DOWN', diskFree: 1024 * 1024 * 1024 }),
    );

    const text = readableText(hostElement(fixture));
    expect(text).toContain('Проверки DOWN');
    expect(text).toContain('разработка');
    expect(hostElement(fixture).querySelector('.tb-negative')).not.toBeNull();
    expect(text).toContain('Мало места');

    fixture.componentInstance.load();
    await answer(systemStatus({ diskTotal: 0 }));
  });

  it('counts the events and the deliveries that wait and leads to the journal', async () => {
    create();
    await answer(systemStatus(), [eventPublication(), eventPublication()], [failedDelivery()]);
    answerPortal();

    const text = readableText(hostElement(fixture));
    expect(text).toContain('Необработанные события 2');
    expect(text).toContain('Неудачные доставки в мессенджеры 1');
    expect(text).toContain('Разобрать в журнале');
    expect(text).not.toContain('Всё обработано');
  });

  it('does not stop when the queue or the backups cannot be read', async () => {
    create();
    backend.expectOne('/api/admin/status').flush(systemStatus());
    backend.expectOne('/api/admin/events').flush(null, { status: 500, statusText: 'Error' });
    backend
      .expectOne('/api/admin/notifications/deliveries')
      .flush(null, { status: 500, statusText: 'Error' });
    backend.expectOne('/api/admin/backups').flush(null, { status: 500, statusText: 'Error' });
    fixture.detectChanges();
    answerPortal();
    await fixture.whenStable();

    const text = readableText(hostElement(fixture));
    expect(text).toContain('Необработанные события —');
    expect(text).toContain('Копий ещё нет');
  });

  it('collects the diagnostics archive from the header', async () => {
    await render(systemStatus());

    buttonByText(hostElement(fixture), 'Собрать диагностику').click();
    const archive = new Blob(['zip']);
    backend.expectOne('/api/admin/diagnostics').flush(archive);

    expect(save).toHaveBeenCalledWith(archive, ARCHIVE_NAME);
  });

  it('survives a failed download', async () => {
    await render(systemStatus());

    fixture.componentInstance.collect();
    backend
      .expectOne('/api/admin/diagnostics')
      .flush(new Blob(), { status: 500, statusText: 'Error' });

    expect(save).not.toHaveBeenCalled();
  });
});
