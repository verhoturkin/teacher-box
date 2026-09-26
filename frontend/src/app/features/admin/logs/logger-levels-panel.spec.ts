import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MessageService } from 'primeng/api';
import { providePrimeNG } from 'primeng/config';
import { loggerLevel } from '@testing/admin-fixtures';
import { buttonByText, hostElement, readableText } from '@testing/dom';
import { LoggerLevelsPanel } from './logger-levels-panel';

describe('LoggerLevelsPanel', () => {
  let fixture: ComponentFixture<LoggerLevelsPanel>;
  let backend: HttpTestingController;
  let messages: MessageService;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [LoggerLevelsPanel],
      providers: [provideHttpClient(), provideHttpClientTesting(), providePrimeNG(), MessageService],
    });
    backend = TestBed.inject(HttpTestingController);
    messages = TestBed.inject(MessageService);
    vi.spyOn(messages, 'add');
    fixture = TestBed.createComponent(LoggerLevelsPanel);
    fixture.detectChanges();
    backend.expectOne('/api/admin/loggers').flush([
      loggerLevel(),
      loggerLevel({
        name: 'ru.teacherbox.notifications',
        configuredLevel: 'DEBUG',
        effectiveLevel: 'DEBUG',
        revertAt: '2026-09-26T12:30:00Z',
      }),
    ]);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(() => {
    fixture.destroy();
    backend.verify();
  });

  it('shows the levels and when temporary ones end', () => {
    const text = readableText(hostElement(fixture));

    expect(text).toContain('ru.teacherbox INFO —');
    expect(text).toContain('ru.teacherbox.notifications DEBUG');
    expect(text).toContain('Вернуть');
  });

  it('switches a part of the log to DEBUG for a while', async () => {
    fixture.componentInstance.form.patchValue({ name: ' ru.teacherbox.ai ', level: 'DEBUG', minutes: 60 });
    buttonByText(hostElement(fixture), 'Применить').click();

    const change = backend.expectOne({ method: 'PUT', url: '/api/admin/loggers/ru.teacherbox.ai' });
    expect(change.request.body).toEqual({ level: 'DEBUG', minutes: 60 });
    change.flush(loggerLevel({ name: 'ru.teacherbox.ai', effectiveLevel: 'DEBUG' }));
    backend.expectOne('/api/admin/loggers').flush([]);
    await fixture.whenStable();

    expect(messages.add).toHaveBeenCalledWith(expect.objectContaining({ detail: 'ru.teacherbox.ai: DEBUG' }));
  });

  it('keeps the form after a failed change and reverts levels', () => {
    fixture.componentInstance.apply();
    backend
      .expectOne({ method: 'PUT', url: '/api/admin/loggers/ru.teacherbox' })
      .flush({ status: 422, code: 'admin.logger-invalid' }, { status: 422, statusText: 'Unprocessable' });

    buttonByText(hostElement(fixture), 'Вернуть').click();
    backend.expectOne({ method: 'DELETE', url: '/api/admin/loggers/ru.teacherbox.notifications' }).flush(loggerLevel());
    backend.expectOne('/api/admin/loggers').flush([loggerLevel()]);

    fixture.componentInstance.form.controls.name.setValue('');
    fixture.componentInstance.apply();
    backend.expectNone('/api/admin/loggers/');
  });
});
