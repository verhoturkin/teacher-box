import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { buttonByText, hostElement, readableText } from '@testing/dom';
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
    inputs: { open?: string; google?: string } = {},
    backups: BackupInfo[] = [BACKUP],
  ): Promise<HTMLElement> {
    TestBed.configureTestingModule({
      imports: [SettingsPage],
      providers: testProviders(),
    });
    backend = TestBed.inject(HttpTestingController);
    vi.spyOn(TestBed.inject(MessageService), 'add');
    fixture = TestBed.createComponent(SettingsPage);
    for (const [name, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(name, value);
    }
    fixture.detectChanges();
    backend.expectOne('/api/teacher/notifications/status').flush(status);
    await fixture.whenStable();
    const open = new Set((inputs.open ?? '').split(','));
    if (open.has('portal')) {
      backend.expectOne('/api/teacher/portal').flush(portalSettings());
    }
    if (open.has('calendar') || inputs.google !== undefined) {
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
      backend.expectOne('/api/teacher/meetings/calls').flush({ status: 'OFF', rooms: [] });
    }
    if (open.has('data')) {
      backend.expectOne('/api/teacher/backups').flush(backups);
    }
    await fixture.whenStable();
    return hostElement(fixture);
  }

  afterEach(() => {
    backend.verify();
    fixture.destroy();
  });

  it('shows the sections folded, without integrations, the failed deliveries counted', async () => {
    const host = await render();

    const text = readableText(host);
    expect(text).toContain('Портал Название, логотип и цвет портала');
    expect(text).toContain('Календарь и звонки');
    expect(text).toContain('Неудачные доставки 2');
    expect(text).toContain('Данные');
    expect(text).not.toContain('Профиль');
    expect(text).not.toContain('Интеграции');
    expect(text).not.toContain('ИИ-помощник');
    expect(host.querySelector('#portal')).toBeNull();
  });

  it('shows every open section', async () => {
    const host = await render(STATUS, { open: 'portal,calendar,deliveries,data' });

    const text = readableText(host);
    expect(host.querySelector('#portal')).not.toBeNull();
    expect(host.querySelector('#google')).not.toBeNull();
    expect(host.querySelector('#meetings')).not.toBeNull();
    expect(text).toContain('Мария Telegram Telegram 403: Forbidden: bot was blocked by the user');
    expect(text).toContain('Вы MAX —');
    expect(host.querySelector('#backups')).not.toBeNull();
    expect(host.querySelector('#reset')).not.toBeNull();
  });

  it('opens the calendar after Google sends the teacher back', async () => {
    const host = await render(STATUS, { google: 'connected' });

    expect(host.querySelector('#google')).not.toBeNull();
    expect(host.querySelector('#portal')).toBeNull();
  });

  it('keeps the open sections in the address', async () => {
    const host = await render(STATUS, { open: 'deliveries' });
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    buttonByText(host, 'Портал').click();
    expect(navigate).toHaveBeenLastCalledWith([], {
      queryParams: { open: 'portal,deliveries' },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
    buttonByText(host, 'Неудачные доставки').click();
    expect(navigate).toHaveBeenLastCalledWith([], {
      queryParams: { open: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
    backend.match('/api/teacher/portal').forEach((request) => {
      request.flush(portalSettings());
    });
  });

  it('says when every notification was delivered', async () => {
    const host = await render({ channels: [], failedDeliveries: [] }, { open: 'deliveries' });

    expect(readableText(host)).toContain('Все уведомления доставлены');
  });
});
