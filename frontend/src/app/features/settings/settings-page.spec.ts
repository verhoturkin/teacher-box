import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MessageService } from 'primeng/api';
import { PageDetail } from '@core/routing/page-detail';
import { hostElement, readableText, requireElement } from '@testing/dom';
import { portalSettings } from '@testing/portal-fixtures';
import { screenWidth, testProviders } from '@testing/setup';
import { BackupInfo, NotificationsStatus } from './data-access/settings.models';
import { SettingsPage } from './settings-page';
import { SettingsCategory } from './settings-categories';

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

  /** Answers what the panels of a category ask for. */
  function flushCategory(category: SettingsCategory): void {
    switch (category) {
      case 'account':
        backend.expectOne('/api/me');
        break;
      case 'portal':
        backend.expectOne('/api/teacher/portal').flush(portalSettings());
        break;
      case 'calendar':
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
        break;
      case 'messengers':
        break;
      case 'data':
        backend.expectOne('/api/teacher/backups').flush([BACKUP]);
        backend.expectOne('/api/teacher/backups/google').flush({
          clientConfigured: false,
          clientFromEnvironment: false,
          clientId: null,
          connected: false,
          account: null,
          connectedAt: null,
          lastUploadAt: null,
          lastUploadName: null,
          lastError: null,
          running: null,
          callbackPath: '/api/public/backups/google/callback',
        });
        break;
    }
  }

  /** The page at `width` px; `shown` — the category whose panels are on the screen, if any. */
  async function render(
    width: number,
    category: SettingsCategory | undefined,
    shown: SettingsCategory | null = category ?? null,
    status = STATUS,
  ): Promise<HTMLElement> {
    TestBed.configureTestingModule({
      imports: [SettingsPage],
      providers: [...testProviders(), screenWidth(width)],
    });
    backend = TestBed.inject(HttpTestingController);
    vi.spyOn(TestBed.inject(MessageService), 'add');
    fixture = TestBed.createComponent(SettingsPage);
    if (category !== undefined) {
      fixture.componentRef.setInput('category', category);
    }
    fixture.detectChanges();
    backend.expectOne('/api/teacher/notifications/status').flush(status);
    await fixture.whenStable();
    if (shown !== null) {
      flushCategory(shown);
    }
    await fixture.whenStable();
    return hostElement(fixture);
  }

  function panes(host: HTMLElement): HTMLElement[] {
    return Array.from(host.querySelectorAll<HTMLElement>('tb-pane'));
  }

  function current(host: HTMLElement): string | undefined {
    return host.querySelector('[aria-current="page"] .tb-settings__title')?.textContent.trim();
  }

  afterEach(() => {
    backend.verify();
    fixture.destroy();
  });

  it('lists the categories with what they hold, the failed deliveries counted', async () => {
    const host = await render(1200, undefined, 'account');

    const list = readableText(requireElement(host, 'nav', HTMLElement));
    expect(list).toContain('Мой аккаунт Фото, имя и пароль');
    expect(list).toContain('Портал Название, логотип и цвет портала');
    expect(list).toContain('Календарь и звонки');
    expect(list).toContain('Мессенджеры Уведомления, которые не дошли до мессенджера 2');
    expect(list).toContain('Данные');
    expect(list).not.toContain('Интеграции');
    const links = Array.from(host.querySelectorAll('nav a')).map((link) =>
      link.getAttribute('href'),
    );
    expect(links).toEqual([
      '/teacher/settings/account',
      '/teacher/settings/portal',
      '/teacher/settings/calendar',
      '/teacher/settings/messengers',
      '/teacher/settings/data',
    ]);
  });

  it('shows the account beside the list of /teacher/settings from expanded', async () => {
    const host = await render(1200, undefined, 'account');

    expect(panes(host)).toHaveLength(2);
    expect(host.querySelector('h1')?.textContent).toContain('Настройки');
    expect(host.querySelector('h2.tb-settings__heading')?.textContent).toContain('Мой аккаунт');
    expect(host.querySelector('tb-account-panel')).not.toBeNull();
    expect(current(host)).toBe('Мой аккаунт');
    expect(TestBed.inject(PageDetail).value()).toBe('Мой аккаунт');
  });

  it.each([840, 1200])('keeps the list in the fixed pane at %i px', async (width) => {
    const host = await render(width, 'portal');

    const [list, detail] = panes(host);
    expect(list?.style.flexBasis).toBe(width === 840 ? '22.5rem' : '25.75rem');
    expect(detail?.style.flexGrow).toBe('1');
    expect(host.querySelector('#portal')).not.toBeNull();
    expect(current(host)).toBe('Портал');
  });

  it.each([600, 839])('gives the list and the category 50 % each at %i px', async (width) => {
    const host = await render(width, 'portal');

    const all = panes(host);
    expect(all).toHaveLength(2);
    for (const pane of all) {
      expect(pane.style.flexBasis).toBe('0%');
      expect(pane.style.flexGrow).toBe('1');
    }
    expect(host.querySelector('tb-panes')?.classList).not.toContain('tb-panes--single');
    expect(host.querySelector('.tb-page-header__back')).toBeNull();
  });

  it('shows only the list of /teacher/settings at 599 px', async () => {
    const host = await render(599, undefined, null);

    expect(panes(host)).toHaveLength(1);
    expect(host.querySelector('nav')).not.toBeNull();
    expect(current(host)).toBeUndefined();
    expect(host.querySelector('tb-account-panel')).toBeNull();
    expect(TestBed.inject(PageDetail).value()).toBeNull();
  });

  it('shows only the category at 599 px, «back» leads to the list', async () => {
    const host = await render(599, 'data');

    expect(panes(host)).toHaveLength(1);
    expect(host.querySelector('nav')).toBeNull();
    expect(host.querySelector('h1')?.textContent).toContain('Данные');
    const back = requireElement(host, '.tb-page-header__back', HTMLElement);
    expect(back.getAttribute('href')).toBe('/teacher/settings');
    expect(back.getAttribute('aria-label')).toBe('Все настройки');
    expect(host.querySelector('#backups')).not.toBeNull();
    expect(host.querySelector('#drive')).not.toBeNull();
    expect(host.querySelector('#reset')).not.toBeNull();
  });

  it('shows the calendar and the calls', async () => {
    const host = await render(1200, 'calendar');

    expect(host.querySelector('#google')).not.toBeNull();
    expect(host.querySelector('#meetings')).not.toBeNull();
  });

  it('shows the failed deliveries in the messengers', async () => {
    const host = await render(1200, 'messengers');

    const text = readableText(host);
    expect(text).toContain('Неудачные доставки');
    expect(text).toContain('Мария Telegram Telegram 403: Forbidden: bot was blocked by the user');
    expect(text).toContain('Вы MAX —');
  });

  it('says when every notification was delivered, without a badge', async () => {
    const host = await render(1200, 'messengers', 'messengers', {
      channels: [],
      failedDeliveries: [],
    });

    expect(readableText(host)).toContain('Все уведомления доставлены');
    expect(host.querySelector('p-badge')).toBeNull();
  });
});
