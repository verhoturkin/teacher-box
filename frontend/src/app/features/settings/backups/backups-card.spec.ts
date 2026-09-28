import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ConfirmationService, MessageService } from 'primeng/api';
import { FileSaver } from '@shared/files/file-saver';
import { bodyText, buttonByText, hostElement, readableText } from '@testing/dom';
import { BackupInfo } from '../data-access/settings.models';
import { BackupsArea } from './backups-api';
import { BackupsCard } from './backups-card';
import { RESTART_POLL_MS } from '@shared/restart/restart-wait';
import { testProviders } from '@testing/setup';

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

  it('lists the backups with why they were made', async () => {
    const host = await render();

    const text = readableText(host);
    expect(text).toContain('перед сбросом');
    expect(text).toContain('по расписанию');
    expect(text).toContain('2,5 МБ');
    expect(text).not.toContain('Скачать копию может только учитель');
  });

  it('creates, downloads and deletes backups for the teacher', async () => {
    const host = await render();

    buttonByText(host, 'Создать копию сейчас').click();
    backend.expectOne({ method: 'POST', url: '/api/teacher/backups' }).flush(SCHEDULED);
    backend.expectOne('/api/teacher/backups').flush([SCHEDULED]);
    expect(TestBed.inject(MessageService).add).toHaveBeenCalled();
    await fixture.whenStable();

    buttonByText(host, `Скачать ${SCHEDULED.name}`).click();
    backend.expectOne(`/api/teacher/backups/${SCHEDULED.name}`).flush(new Blob(['zip']));
    expect(saved).toEqual([SCHEDULED.name]);

    const confirm = vi.spyOn(fixture.debugElement.injector.get(ConfirmationService), 'confirm');
    buttonByText(host, `Удалить ${SCHEDULED.name}`).click();
    await fixture.whenStable();
    expect(bodyText()).toContain('Удалить копию?');
    confirm.mock.calls[0]?.[0].accept?.();
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
    expect(host.querySelector(`button[aria-label="Скачать ${SCHEDULED.name}"]`)).toBeNull();
    expect(host.querySelector(`button[aria-label="Удалить ${SCHEDULED.name}"]`)).toBeNull();
    buttonByText(host, 'Создать копию сейчас').click();
    backend.expectOne({ method: 'POST', url: '/api/admin/backups' }).flush(SCHEDULED);
    backend.expectOne('/api/admin/backups').flush([SCHEDULED]);
    await fixture.whenStable();

    buttonByText(host, `Восстановить ${SCHEDULED.name}`).click();
    await fixture.whenStable();
    expect(bodyText()).toContain('Восстановление из копии');
    expect(bodyText()).toContain('Все данные портала заменятся данными из копии');
  });
});
