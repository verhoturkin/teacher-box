import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { Portal } from '@core/portal/portal';
import { bodyText, buttonByText, hostElement, requireElement, typeInto } from '@testing/dom';
import { ResetCard } from './reset-card';
import { testProviders } from '@testing/setup';

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
    buttonByText(hostElement(fixture), 'Сбросить все данные…').click();
    await fixture.whenStable();
    typeInto(requireElement(document.body, '#reset-password', HTMLInputElement), password);
    typeInto(requireElement(document.body, '#reset-word', HTMLInputElement), word);
    await fixture.whenStable();
  }

  it('deletes everything after the password and the word, then opens the first setup', async () => {
    expect(hostElement(fixture).textContent).toContain('Остаются вход учителя и администратора');
    const portal = TestBed.inject(Portal);
    portal.setSetupCompleted(true);
    await fill('teacher-password', 'сбросить');
    expect(bodyText()).toContain('Сбросить все данные?');

    submitButton().click();
    const request = backend.expectOne({ method: 'POST', url: '/api/teacher/reset' });
    expect(request.request.body).toEqual({ password: 'teacher-password' });
    request.flush({
      backup: 'teacherbox-20260927-120000-000.zip',
      hints: ['Календарь портала остался в Google Календаре — удалите его там вручную.'],
    });
    backend.expectOne('/api/public/portal').flush({ name: 'Teacher Box', address: null });
    await vi.waitFor(() => {
      expect(navigate).toHaveBeenCalledWith('/teacher/setup');
    });

    expect(TestBed.inject(MessageService).add).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: 'Копия перед сбросом: teacherbox-20260927-120000-000.zip',
      }),
    );
    expect(TestBed.inject(MessageService).add).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'warn', sticky: true }),
    );
    const setup = portal.setupCompleted();
    backend.expectOne('/api/teacher/portal').flush({
      name: 'Teacher Box',
      address: null,
      addressFromEnvironment: false,
      setupCompleted: false,
    });
    expect(await setup).toBe(false);
  });

  it('does nothing without the word and shows a wrong password', async () => {
    await fill('wrong', 'удалить');
    expect(submitButton().disabled).toBe(true);
    fixture.componentInstance.reset();

    typeInto(requireElement(document.body, '#reset-word', HTMLInputElement), ' СБРОСИТЬ ');
    await fixture.whenStable();
    fixture.componentInstance.reset();
    fixture.componentInstance.reset();
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
