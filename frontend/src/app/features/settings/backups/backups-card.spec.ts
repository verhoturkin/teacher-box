import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ConfirmationService, MessageService } from 'primeng/api';
import { FileSaver } from '@shared/files/file-saver';
import { bodyText, buttonByText, hostElement, menuItemByText, readableText } from '@testing/dom';
import { BackupInfo, DriveStatus } from '../data-access/settings.models';
import { DriveStore } from './drive-store';
import { BackupsArea } from './backups-api';
import { BackupsCard } from './backups-card';
import { RESTART_POLL_MS } from '@shared/restart/restart-wait';
import { testProviders, ConfirmHost } from '@testing/setup';

const SCHEDULED: BackupInfo = {
  name: 'teacherbox-20260925-033000-000.zip',
  size: 2_621_440,
  createdAt: '2026-09-25T00:30:00Z',
  kind: 'SCHEDULED',
  version: '1.3.0',
};
const BEFORE_RESET: BackupInfo = {
  ...SCHEDULED,
  name: 'teacherbox-20260926-120000-000.zip',
  kind: 'BEFORE_RESET',
};
const DRIVE: DriveStatus = {
  clientConfigured: true,
  clientFromEnvironment: false,
  clientId: 'id',
  connected: true,
  account: 'teacher@example.com',
  connectedAt: '2026-10-01T10:00:00Z',
  lastUploadAt: null,
  lastUploadName: null,
  lastError: null,
  running: null,
  callbackPath: '/api/public/backups/google/callback',
};
const OLD: BackupInfo = {
  ...SCHEDULED,
  name: 'teacherbox-20260101-033000-000.zip',
  kind: null,
  version: null,
};

describe('BackupsCard', () => {
  let fixture: ComponentFixture<BackupsCard>;
  let backend: HttpTestingController;
  let saved: string[];

  async function render(
    area: BackupsArea = 'teacher',
    backups: BackupInfo[] = [BEFORE_RESET, SCHEDULED, OLD],
  ): Promise<HTMLElement> {
    TestBed.configureTestingModule({
      imports: [BackupsCard],
      providers: testProviders({ provide: RESTART_POLL_MS, useValue: 1_000_000 }),
    });
    backend = TestBed.inject(HttpTestingController);
    saved = [];
    vi.spyOn(TestBed.inject(FileSaver), 'save').mockImplementation((_blob, name) => {
      saved.push(name);
    });
    vi.spyOn(TestBed.inject(MessageService), 'add');
    TestBed.createComponent(ConfirmHost).detectChanges();
    fixture = TestBed.createComponent(BackupsCard);
    fixture.componentRef.setInput('area', area);
    fixture.detectChanges();
    backend.expectOne(`/api/${area}/backups`).flush(backups);
    await fixture.whenStable();
    return hostElement(fixture);
  }

  afterEach(() => {
    backend.verify();
    fixture.destroy();
  });

  it('shows a failed load with «Повторить», not «no backups»', async () => {
    TestBed.configureTestingModule({
      imports: [BackupsCard],
      providers: testProviders({ provide: RESTART_POLL_MS, useValue: 1_000_000 }),
    });
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(BackupsCard);
    fixture.detectChanges();
    backend.expectOne('/api/teacher/backups').flush(null, { status: 500, statusText: 'Error' });
    await fixture.whenStable();
    const host = hostElement(fixture);

    expect(readableText(host)).toContain('Не удалось загрузить список копий');
    expect(readableText(host)).not.toContain('Копий пока нет');

    buttonByText(host, 'Повторить').click();
    backend.expectOne('/api/teacher/backups').flush([]);
    await fixture.whenStable();

    expect(readableText(host)).toContain('Копий пока нет');
  });

  it('lists the backups with why they were made', async () => {
    const host = await render();

    const text = readableText(host);
    expect(text).toContain('перед сбросом · 2,5 МБ');
    expect(text).toContain('по расписанию · 2,5 МБ');
    expect(host.querySelectorAll('li')).toHaveLength(3);
    expect(text).not.toContain('Скачать копию может только учитель');
  });

  it('creates, downloads and deletes backups for the teacher', async () => {
    const host = await render();

    buttonByText(host, 'Создать копию сейчас').click();
    backend.expectOne({ method: 'POST', url: '/api/teacher/backups' }).flush(SCHEDULED);
    backend.expectOne('/api/teacher/backups').flush([SCHEDULED]);
    expect(TestBed.inject(MessageService).add).toHaveBeenCalled();
    await fixture.whenStable();

    const actions = buttonByText(host, `Действия: ${SCHEDULED.name}`);
    actions.click();
    await fixture.whenStable();
    expect(actions.getAttribute('aria-expanded')).toBe('true');
    menuItemByText('Скачать').click();
    backend.expectOne(`/api/teacher/backups/${SCHEDULED.name}`).flush(new Blob(['zip']));
    expect(saved).toEqual([SCHEDULED.name]);

    const confirm = vi.spyOn(fixture.debugElement.injector.get(ConfirmationService), 'confirm');
    buttonByText(host, `Действия: ${SCHEDULED.name}`).click();
    await fixture.whenStable();
    menuItemByText('Удалить').click();
    await fixture.whenStable();
    expect(bodyText()).toContain('Удалить копию?');
    confirm.mock.calls[0]?.[0].accept?.();
    await fixture.whenStable();
    backend
      .expectOne({ method: 'DELETE', url: `/api/teacher/backups/${SCHEDULED.name}` })
      .flush(null);
    backend.expectOne('/api/teacher/backups').flush([]);
    await fixture.whenStable();
    expect(readableText(host)).toContain('Копий пока нет');
  });

  it('keeps working when creating a backup fails', async () => {
    const host = await render('teacher', []);

    fixture.componentInstance.create();
    backend
      .expectOne({ method: 'POST', url: '/api/teacher/backups' })
      .flush(null, { status: 500, statusText: 'Error' });
    await fixture.whenStable();

    expect(buttonByText(host, 'Создать копию сейчас').disabled).toBe(false);
  });

  it('lets the administrator create and restore, but not download or delete', async () => {
    const host = await render('admin');

    expect(readableText(host)).toContain('Скачать копию может только учитель');
    buttonByText(host, 'Создать копию сейчас').click();
    backend.expectOne({ method: 'POST', url: '/api/admin/backups' }).flush(SCHEDULED);
    backend.expectOne('/api/admin/backups').flush([SCHEDULED]);
    await fixture.whenStable();

    buttonByText(host, `Действия: ${SCHEDULED.name}`).click();
    await fixture.whenStable();
    expect(() => menuItemByText('Скачать')).toThrow();
    expect(() => menuItemByText('Удалить')).toThrow();
    menuItemByText('Восстановить').click();
    await fixture.whenStable();
    expect(bodyText()).toContain('Восстановление из копии');
    expect(bodyText()).toContain('Все данные портала заменятся данными из копии');
  });

  it.each(['teacher', 'admin'] as const)(
    'marks cloud copies and sends one there for %s',
    async (area) => {
      TestBed.configureTestingModule({
        imports: [BackupsCard],
        providers: testProviders({ provide: RESTART_POLL_MS, useValue: 1_000_000 }),
      });
      const drive = TestBed.inject(DriveStore);
      drive.status.set(DRIVE);
      drive.files.set([{ id: '1', name: SCHEDULED.name, size: 1, createdAt: null }]);
      backend = TestBed.inject(HttpTestingController);
      vi.spyOn(TestBed.inject(MessageService), 'add');
      fixture = TestBed.createComponent(BackupsCard);
      fixture.componentRef.setInput('area', area);
      fixture.detectChanges();
      backend.expectOne(`/api/${area}/backups`).flush([BEFORE_RESET, SCHEDULED]);
      await fixture.whenStable();
      const host = hostElement(fixture);

      expect(readableText(host)).toContain('по расписанию · 2,5 МБ · в Google Диске');
      expect(readableText(host)).not.toContain('перед сбросом · 2,5 МБ · в Google Диске');
      expect([...drive.local()]).toEqual([BEFORE_RESET.name, SCHEDULED.name]);

      buttonByText(host, `Действия: ${BEFORE_RESET.name}`).click();
      await fixture.whenStable();
      menuItemByText('Отправить в Google Диск').click();
      backend
        .expectOne({
          method: 'POST',
          url: `/api/${area}/backups/google/uploads/${BEFORE_RESET.name}`,
        })
        .flush(DRIVE);
      expect(TestBed.inject(MessageService).add).toHaveBeenCalled();
      backend.expectOne(`/api/${area}/backups/google`).flush(DRIVE);
      backend.expectOne(`/api/${area}/backups/google/files`).flush([]);

      buttonByText(host, 'Создать копию сейчас').click();
      backend.expectOne({ method: 'POST', url: `/api/${area}/backups` }).flush(SCHEDULED);
      backend.expectOne(`/api/${area}/backups`).flush([SCHEDULED]);
      backend.expectOne(`/api/${area}/backups/google`).flush({ ...DRIVE, connected: false });

      drive.arrived.update((count) => count + 1);
      await fixture.whenStable();
      backend.expectOne(`/api/${area}/backups`).flush([SCHEDULED]);
    },
  );

  it('does not offer the Google Drive without a connection', async () => {
    const host = await render();

    buttonByText(host, `Действия: ${SCHEDULED.name}`).click();
    await fixture.whenStable();
    expect(() => menuItemByText('Отправить в Google Диск')).toThrow();
  });
});
