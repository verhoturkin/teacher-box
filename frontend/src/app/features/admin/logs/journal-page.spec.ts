import { HttpTestingController, TestRequest } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { logEntry, logResult, loggerLevel } from '@testing/admin-fixtures';
import { buttonByText, hostElement, readableText, requireElement } from '@testing/dom';
import { LogResult } from '../data-access/admin.models';
import { JournalPage } from './journal-page';
import { screenWidth, testProviders } from '@testing/setup';

describe('JournalPage', () => {
  let fixture: ComponentFixture<JournalPage>;
  let backend: HttpTestingController;
  const now = new Date('2026-09-26T12:00:00Z');

  function logsRequest(): TestRequest {
    return backend.expectOne((request) => request.url === '/api/admin/logs');
  }

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
  }

  function create(inputs: Record<string, unknown>, width = 1600): void {
    TestBed.configureTestingModule({
      imports: [JournalPage],
      providers: testProviders(screenWidth(width)),
    });
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(JournalPage);
    fixture.componentRef.setInput('now', now);
    for (const [name, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(name, value);
    }
    fixture.detectChanges();
  }

  /** The detail of nothing chosen holds the temporary log levels. */
  async function render(
    result: LogResult,
    inputs: Record<string, unknown> = {},
    width = 1600,
  ): Promise<TestRequest> {
    create(inputs, width);
    const request = logsRequest();
    request.flush(result);
    await settle();
    backend.match('/api/admin/loggers').forEach((levels) => {
      levels.flush([loggerLevel()]);
    });
    await settle();
    return request;
  }

  function row(text: string): HTMLButtonElement {
    const button = Array.from(
      hostElement(fixture).querySelectorAll<HTMLButtonElement>('li button.tb-journal__row'),
    ).find((candidate) => candidate.textContent.includes(text));
    if (!button) {
      throw new Error(`Row not found: ${text}`);
    }
    return button;
  }

  afterEach(() => {
    backend.match('/api/admin/loggers').forEach((levels) => {
      levels.flush([]);
    });
    fixture.destroy();
    backend.verify();
  });

  it('lists the last day of the log and opens an entry with its stack trace', async () => {
    const request = await render(
      logResult([
        logEntry(),
        logEntry({ level: 'INFO', message: 'Started', requestId: null, error: null }),
      ]),
    );

    expect(request.request.params.get('from')).toBe('2026-09-25T12:00:00.000Z');
    expect(request.request.params.get('limit')).toBe('200');
    expect(request.request.params.has('level')).toBe(false);
    const text = readableText(hostElement(fixture));
    expect(text).toContain('Unhandled exception');
    expect(text).toContain('web.ProblemDetailsAdvice');
    expect(text).toContain('Выберите запись');
    expect(text).not.toContain('java.lang.IllegalStateException');

    row('Unhandled exception').click();
    await settle();

    const detail = readableText(hostElement(fixture));
    expect(detail).toContain('java.lang.IllegalStateException: boom');
    expect(detail).toContain('tomcat-handler-1');
    expect(hostElement(fixture).querySelector('li.tb-list__item--current')).not.toBeNull();
  });

  it('opens a request from the address and follows request codes', async () => {
    const request = await render(logResult([logEntry()]), { requestId: 'k3m9x2ab7c' });
    expect(request.request.params.get('requestId')).toBe('k3m9x2ab7c');
    expect(request.request.params.has('from')).toBe(false);

    row('Unhandled exception').click();
    await settle();
    buttonByText(hostElement(fixture), 'код k3m9x2ab7c').click();
    const follow = logsRequest();
    expect(follow.request.params.get('requestId')).toBe('k3m9x2ab7c');
    follow.flush(logResult([], { truncated: false }));
    await settle();
    backend.match('/api/admin/loggers').forEach((levels) => {
      levels.flush([]);
    });

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
    await settle();

    expect(readableText(hostElement(fixture))).toContain('Показаны последние 1 записей');
  });

  it('shows only the errors with the «Ошибки» chip and the events with «События»', async () => {
    await render(logResult([logEntry()]));

    buttonByText(hostElement(fixture), 'Ошибки').click();
    const errors = logsRequest();
    expect(errors.request.params.get('level')).toBe('ERROR');
    errors.flush(logResult([logEntry()]));
    await settle();
    expect(hostElement(fixture).querySelector('#log-level')).toBeNull();

    buttonByText(hostElement(fixture), 'События').click();
    await settle();
    backend.expectOne('/api/admin/events').flush([]);
    backend.expectOne('/api/admin/notifications/deliveries').flush([]);
    await settle();
    const text = readableText(hostElement(fixture));
    expect(text).toContain('Необработанные события');
    expect(text).not.toContain('Выберите запись');

    buttonByText(hostElement(fixture), 'Логи').click();
    const log = logsRequest();
    expect(log.request.params.has('level')).toBe(false);
    log.flush(logResult([]));
    await settle();
    backend.match('/api/admin/loggers').forEach((levels) => {
      levels.flush([]);
    });
  });

  it('starts on the events view of the address', async () => {
    create({ view: 'events' });
    backend.expectOne('/api/admin/events').flush([]);
    backend.expectOne('/api/admin/notifications/deliveries').flush([]);
    await settle();

    expect(readableText(hostElement(fixture))).toContain('Всё обработано');
  });

  it('starts on the errors view of the address', () => {
    create({ view: 'errors' });

    expect(logsRequest().request.params.get('level')).toBe('ERROR');
  });

  it('takes an unknown view of the address for the log', () => {
    create({ view: 'nonsense' });

    expect(logsRequest().request.params.has('level')).toBe(false);
  });

  it('shows the entry on its own pane on a phone, «back» returns to the list', async () => {
    await render(logResult([logEntry()]), {}, 599);
    expect(readableText(hostElement(fixture))).toContain('Подробный журнал');

    row('Unhandled exception').click();
    await settle();
    expect(readableText(hostElement(fixture))).toContain('java.lang.IllegalStateException: boom');
    expect(hostElement(fixture).querySelector('tb-filter-chips')).toBeNull();

    buttonByText(requireElement(hostElement(fixture), 'tb-pane', HTMLElement), 'К списку').click();
    await settle();

    expect(hostElement(fixture).querySelector('tb-filter-chips')).not.toBeNull();
  });

  it('explains when the log is not written to files', async () => {
    await render(logResult([], { available: false }));

    expect(readableText(hostElement(fixture))).toContain('Журнал не пишется в файл');
  });

  it('survives a failed search', async () => {
    await render(logResult([logEntry()]));

    fixture.componentInstance.search();
    logsRequest().flush(null, { status: 500, statusText: 'Error' });
    await settle();

    expect(readableText(hostElement(fixture))).toContain('Unhandled exception');
  });
});
