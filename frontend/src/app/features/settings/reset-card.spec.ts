import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { Portal } from '@core/portal/portal';
import { bodyText, buttonByText, hostElement, requireElement, typeInto } from '@testing/dom';
import { ResetCard } from './reset-card';
import { testProviders } from '@testing/setup';
import { portalInfo } from '@testing/portal-fixtures';

describe('ResetCard', () => {
  let fixture: ComponentFixture<ResetCard>;
  let backend: HttpTestingController;
  let navigate: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [ResetCard],
      providers: testProviders(),
    });
    backend = TestBed.inject(HttpTestingController);
    navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    vi.spyOn(TestBed.inject(MessageService), 'add');
    fixture = TestBed.createComponent(ResetCard);
    await fixture.whenStable();
  });

  afterEach(() => {
    backend.verify();
    fixture.destroy();
  });

  function submitButton(): HTMLButtonElement {
    return requireElement(document.body, '.p-dialog button[type="submit"]', HTMLButtonElement);
  }

  async function fill(password: string, word: string): Promise<void> {
    buttonByText(hostElement(fixture), 'Очистить…').click();
    await fixture.whenStable();
    typeInto(requireElement(document.body, '#reset-password', HTMLInputElement), password);
    typeInto(requireElement(document.body, '#reset-word', HTMLInputElement), word);
    await fixture.whenStable();
  }

  it('restores the newest backup after the password', async () => {
    buttonByText(hostElement(fixture), 'Восстановить…').click();
    backend.expectOne('/api/teacher/backups').flush([
      {
        name: 'old.zip',
        size: 1,
        createdAt: '2026-09-01T00:30:00Z',
        kind: 'SCHEDULED',
        version: null,
      },
      {
        name: 'new.zip',
        size: 1,
        createdAt: '2026-09-25T00:30:00Z',
        kind: 'MANUAL',
        version: null,
      },
    ]);
    await fixture.whenStable();

    expect(bodyText()).toContain('Восстановить из копии?');
    expect(bodyText()).toContain('25 сентября');
  });

  it('says when there is nothing to restore from', async () => {
    buttonByText(hostElement(fixture), 'Восстановить…').click();
    backend.expectOne('/api/teacher/backups').flush([]);
    await fixture.whenStable();

    expect(TestBed.inject(MessageService).add).toHaveBeenCalledWith(
      expect.objectContaining({ detail: 'Копий пока нет' }),
    );
  });

  it('keeps the button working when the list does not load', async () => {
    buttonByText(hostElement(fixture), 'Восстановить…').click();
    backend.expectOne('/api/teacher/backups').flush(null, { status: 500, statusText: 'Error' });
    await fixture.whenStable();

    expect(buttonByText(hostElement(fixture), 'Восстановить…').disabled).toBe(false);
  });

  it('deletes everything after the password and the word, then opens the first setup', async () => {
    const portal = TestBed.inject(Portal);
    portal.setSetupCompleted(true);
    await fill('teacher-password', 'сбросить');
    expect(bodyText()).toContain('Сбросить все данные?');
    expect(bodyText()).toContain('Остаются вход учителя и администратора');

    submitButton().click();
    const request = backend.expectOne({ method: 'POST', url: '/api/teacher/reset' });
    expect(request.request.body).toEqual({ password: 'teacher-password' });
    request.flush({
      backup: 'teacherbox-20260927-120000-000.zip',
      hints: ['Календарь портала остался в Google Календаре — удалите его там вручную.'],
    });
    backend
      .expectOne('/api/public/portal')
      .flush(portalInfo({ name: 'Teacher Box', address: null }));
    await vi.waitFor(() => {
      expect(navigate).toHaveBeenCalledWith('/teacher/setup');
    });

    expect(TestBed.inject(MessageService).add).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: 'Данные удалены. Копия перед сбросом: teacherbox-20260927-120000-000.zip',
      }),
    );
    expect(TestBed.inject(MessageService).add).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'info', sticky: true }),
    );
    const setup = portal.setupCompleted();
    backend.expectOne('/api/teacher/portal').flush({
      name: 'Teacher Box',
      address: null,
      setupCompleted: false,
    });
    expect(await setup).toBe(false);
  });

  it('does nothing without the word and shows a wrong password', async () => {
    await fill('wrong', 'удалить');
    submitButton().click();
    await fixture.whenStable();
    expect(bodyText()).toContain('Неверный формат');
    backend.expectNone('/api/teacher/reset');

    typeInto(requireElement(document.body, '#reset-word', HTMLInputElement), ' СБРОСИТЬ ');
    await fixture.whenStable();
    submitButton().click();
    submitButton().click();
    backend
      .expectOne('/api/teacher/reset')
      .flush(
        { status: 422, code: 'password.wrong-current' },
        { status: 422, statusText: 'Unprocessable Content' },
      );
    await fixture.whenStable();

    expect(bodyText()).toContain('Текущий пароль указан неверно');
    expect(navigate).not.toHaveBeenCalled();
  });
});
