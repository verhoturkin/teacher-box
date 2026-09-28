import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { AuthService } from '@core/auth/auth.service';
import { authResponse } from '@testing/auth';
import { bodyText, buttonByText, readableText, requireElement, typeInto } from '@testing/dom';
import { BackupInfo, RestoreStatus } from '../data-access/settings.models';
import { RESTART_POLL_MS, RestoreDialog } from './restore-dialog';
import { testProviders } from '@testing/setup';

const BACKUP: BackupInfo = {
  name: 'teacherbox-20260925-033000-000.zip',
  size: 1000,
  createdAt: '2026-09-25T00:30:00Z',
  kind: 'SCHEDULED',
  version: '1.3.0',
};

function status(overrides: Partial<RestoreStatus> = {}): RestoreStatus {
  return {
    startedAt: '2026-09-27T10:00:00Z',
    restartEnabled: true,
    pending: null,
    lastRestore: null,
    ...overrides,
  };
}

describe('RestoreDialog', () => {
  let fixture: ComponentFixture<RestoreDialog>;
  let backend: HttpTestingController;

  async function open(pollMs = 1_000_000): Promise<void> {
    TestBed.configureTestingModule({
      imports: [RestoreDialog],
      providers: testProviders({ provide: RESTART_POLL_MS, useValue: pollMs }),
    });
    backend = TestBed.inject(HttpTestingController);
    TestBed.inject(AuthService).acceptSession(authResponse('ADMIN'));
    vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    fixture = TestBed.createComponent(RestoreDialog);
    fixture.componentRef.setInput('backup', BACKUP);
    fixture.componentRef.setInput('area', 'admin');
    fixture.componentRef.setInput('visible', true);
    await fixture.whenStable();
  }

  afterEach(() => {
    backend.verify();
    fixture.destroy();
  });

  async function confirmWith(password: string): Promise<void> {
    typeInto(requireElement(document.body, '#restore-password', HTMLInputElement), password);
    await fixture.whenStable();
    buttonByText(document.body, 'Восстановить').click();
    backend.expectOne('/api/admin/backups/restore').flush(status());
  }

  it('warns, asks for the password and waits for the restarted portal', async () => {
    await open();
    expect(bodyText()).toContain('Всё, что добавлено позже');

    await confirmWith('admin-password');
    const request = backend.expectOne({
      method: 'POST',
      url: `/api/admin/backups/${BACKUP.name}/restore`,
    });
    expect(request.request.body).toEqual({ password: 'admin-password' });
    request.flush({ archive: BACKUP.name, safetyBackup: 'teacherbox-x.zip', restarting: true });
    await fixture.whenStable();
    expect(bodyText()).toContain('Портал перезапускается');

    fixture.componentInstance.checkRestart();
    backend
      .expectOne('/api/admin/backups/restore')
      .flush(null, { status: 502, statusText: 'Bad Gateway' });
    fixture.componentInstance.checkRestart();
    backend.expectOne('/api/admin/backups/restore').flush(status());
    await fixture.whenStable();
    expect(bodyText()).toContain('Портал перезапускается');

    fixture.componentInstance.checkRestart();
    backend.expectOne('/api/admin/backups/restore').flush(
      status({
        startedAt: '2026-09-27T10:05:00Z',
        lastRestore: {
          restored: true,
          archive: BACKUP.name,
          at: '2026-09-27T10:05:00Z',
          error: null,
        },
      }),
    );
    await fixture.whenStable();
    expect(bodyText()).toContain('Копия восстановлена');

    buttonByText(document.body, 'Войти снова').click();
    backend.expectOne('/api/auth/logout').flush(null);
    expect(TestBed.inject(AuthService).isAuthenticated()).toBe(false);
  });

  it('tells when restoring failed and the data stayed', async () => {
    await open();
    await confirmWith('admin-password');
    backend
      .expectOne(`/api/admin/backups/${BACKUP.name}/restore`)
      .flush({ archive: BACKUP.name, safetyBackup: 'x.zip', restarting: true });

    fixture.componentInstance.checkRestart();
    backend.expectOne('/api/admin/backups/restore').flush(
      status({
        startedAt: '2026-09-27T10:05:00Z',
        lastRestore: {
          restored: false,
          archive: BACKUP.name,
          at: '2026-09-27T10:05:00Z',
          error: 'broken',
        },
      }),
    );
    await fixture.whenStable();

    expect(readableText(document.body)).toContain(
      'Восстановить копию не удалось, данные остались прежними. Причина: broken',
    );
  });

  it('asks to restart by hand without a container', async () => {
    await open();
    await confirmWith('admin-password');
    backend
      .expectOne(`/api/admin/backups/${BACKUP.name}/restore`)
      .flush({ archive: BACKUP.name, safetyBackup: 'x.zip', restarting: false });
    await fixture.whenStable();

    expect(bodyText()).toContain('при следующем запуске портала');
  });

  it('shows a wrong password and a silent portal', async () => {
    await open(20);
    fixture.componentInstance.restore();
    await confirmWith('wrong');
    backend
      .expectOne(`/api/admin/backups/${BACKUP.name}/restore`)
      .flush(
        { status: 422, code: 'password.wrong-current' },
        { status: 422, statusText: 'Unprocessable Content' },
      );
    await fixture.whenStable();
    expect(bodyText()).toContain('Текущий пароль указан неверно');

    buttonByText(document.body, 'Восстановить').click();
    backend
      .expectOne('/api/admin/backups/restore')
      .flush(null, { status: 500, statusText: 'Error' });
    await fixture.whenStable();
    expect(bodyText()).toContain('Не удалось восстановить копию');

    buttonByText(document.body, 'Восстановить').click();
    backend.expectOne('/api/admin/backups/restore').flush(status());
    backend
      .expectOne(`/api/admin/backups/${BACKUP.name}/restore`)
      .flush({ archive: BACKUP.name, safetyBackup: 'x.zip', restarting: true });
    vi.spyOn(Date, 'now').mockReturnValue(Number.MAX_SAFE_INTEGER);
    await vi.waitFor(() => {
      expect(bodyText()).toContain('Портал долго не отвечает');
    });
    vi.restoreAllMocks();

    fixture.componentInstance.reset();
    await fixture.whenStable();
    expect(requireElement(document.body, '#restore-password', HTMLInputElement).value).toBe('');
  });
});
