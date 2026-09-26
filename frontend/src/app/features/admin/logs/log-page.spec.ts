import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MessageService } from 'primeng/api';
import { providePrimeNG } from 'primeng/config';
import { logEntry, logResult, loggerLevel } from '@testing/admin-fixtures';
import { buttonByText, hostElement, readableText } from '@testing/dom';
import { LogResult } from '../data-access/admin.models';
import { LogPage } from './log-page';

describe('LogPage', () => {
  let fixture: ComponentFixture<LogPage>;
  let backend: HttpTestingController;
  const now = new Date('2026-09-26T12:00:00Z');

  function logsRequest(): TestRequest {
    return backend.expectOne((request) => request.url === '/api/admin/logs');
  }

  async function render(result: LogResult, requestId?: string): Promise<TestRequest> {
    TestBed.configureTestingModule({
      imports: [LogPage],
      providers: [provideHttpClient(), provideHttpClientTesting(), providePrimeNG(), MessageService],
    });
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(LogPage);
    fixture.componentRef.setInput('now', now);
    if (requestId !== undefined) {
      fixture.componentRef.setInput('requestId', requestId);
    }
    fixture.detectChanges();
    const request = logsRequest();
    request.flush(result);
    backend.expectOne('/api/admin/loggers').flush([loggerLevel()]);
    fixture.detectChanges();
    await fixture.whenStable();
    return request;
  }

  afterEach(() => {
    fixture.destroy();
    backend.verify();
  });

  it('shows the last day of the log', async () => {
    const request = await render(
      logResult([logEntry(), logEntry({ level: 'INFO', message: 'Started', requestId: null, error: null })]),
    );

    expect(request.request.params.get('from')).toBe('2026-09-25T12:00:00.000Z');
    expect(request.request.params.get('limit')).toBe('200');
    const text = readableText(hostElement(fixture));
    expect(text).toContain('ERROR web.ProblemDetailsAdvice Unhandled exception код k3m9x2ab7c');
    expect(text).toContain('Подробности ошибки java.lang.IllegalStateException: boom');
    expect(text).toContain('INFO web.ProblemDetailsAdvice Started');
  });

  it('opens a request from the address and follows request codes', async () => {
    const request = await render(logResult([logEntry()]), 'k3m9x2ab7c');
    expect(request.request.params.get('requestId')).toBe('k3m9x2ab7c');
    expect(request.request.params.has('from')).toBe(false);

    buttonByText(hostElement(fixture), 'код k3m9x2ab7c').click();
    const follow = logsRequest();
    expect(follow.request.params.get('requestId')).toBe('k3m9x2ab7c');
    follow.flush(logResult([], { truncated: false }));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(readableText(hostElement(fixture))).toContain('Ничего не найдено');
  });

  it('filters by level and text', async () => {
    await render(logResult([]));

    fixture.componentInstance.form.patchValue({ level: 'WARN', text: 'timeout', minutes: 60 });
    buttonByText(hostElement(fixture), 'Найти').click();
    const request = logsRequest();
    expect(request.request.params.get('level')).toBe('WARN');
    expect(request.request.params.get('text')).toBe('timeout');
    expect(request.request.params.get('from')).toBe('2026-09-26T11:00:00.000Z');
    request.flush(logResult([logEntry()], { truncated: true }));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(readableText(hostElement(fixture))).toContain('Показаны последние 1 записей');
  });

  it('explains when the log is not written to files', async () => {
    await render(logResult([], { available: false }));

    expect(readableText(hostElement(fixture))).toContain('Журнал не пишется в файл');
  });

  it('survives a failed search', async () => {
    await render(logResult([logEntry()]));

    fixture.componentInstance.search();
    logsRequest().flush(null, { status: 500, statusText: 'Error' });
    fixture.detectChanges();

    expect(readableText(hostElement(fixture))).toContain('Unhandled exception');
  });
});
