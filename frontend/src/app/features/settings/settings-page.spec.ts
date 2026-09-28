import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MessageService } from 'primeng/api';
import { aiStatus } from '@testing/ai-fixtures';
import { hostElement, readableText } from '@testing/dom';
import { yandexStatus } from '@testing/meetings-fixtures';
import { portalSettings } from '@testing/portal-fixtures';
import { BackupInfo, NotificationsStatus } from './data-access/settings.models';
import { SettingsPage } from './settings-page';
import { testProviders } from '@testing/setup';

const BACKUP: BackupInfo = {
  name: 'teacherbox-20260925-033000-000.zip',
  size: 2_621_440,
  createdAt: '2026-09-25T00:30:00Z',
  kind: 'SCHEDULED',
  version: '1.3.0',
};

const STATUS: NotificationsStatus = {
  channels: [
    { channel: 'TELEGRAM', connection: 'OK', error: null, checkedAt: '2026-09-26T10:00:00Z' },
    { channel: 'MAX', connection: 'PENDING', error: null, checkedAt: null },
  ],
  failedDeliveries: [
    {
      recipientId: 's-1',
      recipientName: 'Мария',
      channel: 'TELEGRAM',
      attempts: 1,
      error: 'Telegram 403: Forbidden: bot was blocked by the user',
      text: 'Новое задание',
      createdAt: '2026-09-24T10:00:00Z',
    },
    {
      recipientId: 't-1',
      recipientName: null,
      channel: 'MAX',
      attempts: 8,
      error: null,
      text: 'Работа на проверку',
      createdAt: '2026-09-24T09:00:00Z',
    },
  ],
};

describe('SettingsPage', () => {
  let fixture: ComponentFixture<SettingsPage>;
  let backend: HttpTestingController;

  async function render(
    status = STATUS,
    backups: BackupInfo[] = [BACKUP],
    aiEnabled = true,
  ): Promise<void> {
    TestBed.configureTestingModule({
      imports: [SettingsPage],
      providers: testProviders(),
    });
    backend = TestBed.inject(HttpTestingController);
    vi.spyOn(TestBed.inject(MessageService), 'add');
    fixture = TestBed.createComponent(SettingsPage);
    fixture.detectChanges();
    backend.expectOne('/api/teacher/portal').flush(portalSettings());
    backend.expectOne('/api/teacher/notifications/status').flush(status);
    backend.expectOne('/api/teacher/ai/status').flush(aiStatus({ enabled: aiEnabled }));
    backend.expectOne('/api/teacher/backups').flush(backups);
    backend.expectOne('/api/teacher/schedule/google').flush({
      clientConfigured: false,
      clientFromEnvironment: false,
      clientId: null,
      status: 'NOT_CONNECTED',
      busyEnabled: false,
      lastError: null,
      lastSyncAt: null,
      connectedAt: null,
      callbackPath: '/api/public/schedule/google/callback',
    });
    backend.expectOne('/api/teacher/meetings/yandex').flush(yandexStatus());
    await fixture.whenStable();
  }

  afterEach(() => {
    backend.verify();
    fixture.destroy();
  });

  it('shows integrations and failed deliveries', async () => {
    await render();

    const text = readableText(hostElement(fixture));
    expect(text).toContain('Telegram Работает');
    expect(text).toContain('ВКонтакте Не настроен');
    expect(text).toContain('MAX Подключается');
    expect(text).not.toContain('прокси');
    expect(text).toContain('ИИ-помощник claude-opus-5');
    expect(text).toContain('Мария Telegram Telegram 403: Forbidden: bot was blocked by the user');
    expect(text).toContain('Вы MAX —');
  });

  it('explains a messenger without connection', async () => {
    await render({
      channels: [
        {
          channel: 'TELEGRAM',
          connection: 'ERROR',
          error: 'Telegram getUpdates: Connection timed out',
          checkedAt: null,
        },
        {
          channel: 'VK',
          connection: 'ERROR',
          error: 'VK: 5 User authorization failed',
          checkedAt: null,
        },
      ],
      failedDeliveries: [],
    });

    const text = readableText(hostElement(fixture));
    expect(text).toContain('Telegram Нет связи Telegram getUpdates: Connection timed out');
    expect(text).toContain('укажите прокси в TEACHERBOX_NOTIFICATIONS_TELEGRAM_PROXY');
    expect(text).toContain('ВКонтакте Нет связи VK: 5 User authorization failed MAX');
  });

  it('shows empty states', async () => {
    await render({ channels: [], failedDeliveries: [] }, [], false);

    const text = readableText(hostElement(fixture));
    expect(text).toContain('Все уведомления доставлены');
    expect(text).toContain('Копий пока нет');
    expect(text).toContain('ИИ-помощник Не настроен');
  });
});
