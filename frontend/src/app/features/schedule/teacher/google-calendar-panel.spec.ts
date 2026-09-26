import { Clipboard } from '@angular/cdk/clipboard';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { MessageService } from 'primeng/api';
import { providePrimeNG } from 'primeng/config';
import { buttonByText, hostElement, readableText, requireElement } from '@testing/dom';
import { ExternalNavigation } from '@shared/navigation/external-navigation';
import { GoogleCalendarStatus } from '../data-access/schedule.models';
import { GoogleCalendarPanel } from './google-calendar-panel';

function googleStatus(overrides: Partial<GoogleCalendarStatus> = {}): GoogleCalendarStatus {
  return {
    clientConfigured: false,
    clientFromEnvironment: false,
    clientId: null,
    status: 'NOT_CONNECTED',
    busyEnabled: false,
    lastError: null,
    lastSyncAt: null,
    connectedAt: null,
    callbackPath: '/api/public/schedule/google/callback',
    ...overrides,
  };
}

describe('GoogleCalendarPanel', () => {
  let fixture: ComponentFixture<GoogleCalendarPanel>;
  let backend: HttpTestingController;
  let navigation: ExternalNavigation;

  function setUp(result: string | null = null): void {
    TestBed.configureTestingModule({
      imports: [GoogleCalendarPanel],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        providePrimeNG(),
        MessageService,
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: convertToParamMap(result === null ? {} : { google: result }) } },
        },
      ],
    });
    backend = TestBed.inject(HttpTestingController);
    navigation = TestBed.inject(ExternalNavigation);
    vi.spyOn(navigation, 'origin').mockReturnValue('https://school.example.com');
    vi.spyOn(navigation, 'go').mockImplementation(() => undefined);
    vi.spyOn(TestBed.inject(MessageService), 'add');
    fixture = TestBed.createComponent(GoogleCalendarPanel);
  }

  afterEach(() => {
    backend.verify();
  });

  async function render(status: GoogleCalendarStatus): Promise<HTMLElement> {
    fixture.detectChanges();
    backend.expectOne('/api/teacher/schedule/google').flush(status);
    await fixture.whenStable();
    return hostElement(fixture);
  }

  it('guides through the Google Cloud setup and saves the client', async () => {
    setUp();
    const host = await render(googleStatus());
    const text = readableText(host);
    expect(text).toContain('Google Calendar API');
    expect(text).toContain('Publish app');
    expect(text).toContain('https://school.example.com/api/public/schedule/google/callback');

    fixture.componentInstance.form.setValue({ clientId: ' id-1 ', clientSecret: 'secret' });
    await fixture.whenStable();
    buttonByText(host, 'Сохранить').click();

    const request = backend.expectOne({ method: 'PUT', url: '/api/teacher/schedule/google/client' });
    expect(request.request.body).toEqual({ clientId: 'id-1', clientSecret: 'secret' });
    request.flush(googleStatus({ clientConfigured: true, clientId: 'id-1' }));
    await fixture.whenStable();
    expect(readableText(host)).toContain('Подключить Google');
  });

  it('copies the redirect address', async () => {
    setUp();
    const copy = vi.spyOn(TestBed.inject(Clipboard), 'copy').mockReturnValue(true);
    const host = await render(googleStatus());

    buttonByText(host, 'Копировать адрес').click();

    expect(copy).toHaveBeenCalledWith('https://school.example.com/api/public/schedule/google/callback');
    expect(TestBed.inject(MessageService).add).toHaveBeenCalled();
  });

  it('opens Google’s consent page', async () => {
    setUp();
    const host = await render(googleStatus({ clientConfigured: true, clientId: 'id-1' }));
    requireElement(host, '#google-busy', HTMLInputElement).click();
    await fixture.whenStable();

    buttonByText(host, 'Подключить Google').click();

    const request = backend.expectOne('/api/teacher/schedule/google/authorize');
    expect(request.request.body).toEqual({ origin: 'https://school.example.com', busy: true });
    request.flush({ url: 'https://accounts.google.com/o/oauth2/v2/auth?state=s' });
    expect(navigation.go).toHaveBeenCalledWith('https://accounts.google.com/o/oauth2/v2/auth?state=s');
  });

  it('lets the teacher change the client unless it comes from the environment', async () => {
    setUp();
    const host = await render(googleStatus({ clientConfigured: true, lastError: 'Google token 400' }));
    expect(readableText(host)).toContain('Google token 400');

    buttonByText(host, 'Изменить OAuth-клиент').click();
    await fixture.whenStable();
    expect(readableText(host)).toContain('Client secret');
    buttonByText(host, 'Отмена').click();
    await fixture.whenStable();
    expect(readableText(host)).toContain('Подключить Google');
  });

  it('shows the connection, syncs and disconnects', async () => {
    setUp('connected');
    const host = await render(
      googleStatus({
        clientConfigured: true,
        clientFromEnvironment: true,
        status: 'CONNECTED',
        busyEnabled: true,
        connectedAt: '2026-10-01T10:00:00Z',
        lastSyncAt: '2026-10-01T10:05:00Z',
        lastError: 'Google update event 429',
      }),
    );
    const text = readableText(host);
    expect(text).toContain('Google Календарь подключён');
    expect(text).toContain('Подключён');
    expect(text).toContain('Последняя синхронизация');
    expect(text).toContain('Занятость из вашего основного календаря');
    expect(text).toContain('Google update event 429');

    buttonByText(host, 'Синхронизировать сейчас').click();
    backend.expectOne({ method: 'POST', url: '/api/teacher/schedule/google/sync' }).flush({ changed: 3 });
    expect(TestBed.inject(MessageService).add).toHaveBeenCalledWith(
      expect.objectContaining({ detail: 'Изменено событий: 3' }),
    );
    backend.expectOne('/api/teacher/schedule/google').flush(googleStatus({ status: 'CONNECTED' }));
    await fixture.whenStable();

    buttonByText(host, 'Отключить').click();
    backend.expectOne({ method: 'DELETE', url: '/api/teacher/schedule/google' }).flush(null);
    backend.expectOne('/api/teacher/schedule/google').flush(googleStatus({ clientConfigured: true, clientFromEnvironment: true }));
    await fixture.whenStable();
    expect(readableText(host)).not.toContain('Изменить OAuth-клиент');
    expect(readableText(host)).not.toContain('Google Календарь подключён.');
  });

  it('asks to reconnect and reports the answers of Google', async () => {
    setUp('denied');
    const host = await render(googleStatus({ clientConfigured: true, status: 'NEEDS_RECONNECT' }));

    expect(readableText(host)).toContain('Google больше не принимает доступ портала');
    expect(readableText(host)).toContain('Доступ к календарю не предоставлен');
  });

  it('ignores an unknown answer and stops waiting on errors', async () => {
    setUp('something');
    const host = await render(googleStatus({ clientConfigured: true }));
    expect(readableText(host)).not.toContain('Доступ');

    buttonByText(host, 'Подключить Google').click();
    backend.expectOne('/api/teacher/schedule/google/authorize').flush(null, { status: 422, statusText: 'Unprocessable' });
    fixture.componentInstance.saveClient();
    buttonByText(host, 'Изменить OAuth-клиент').click();
    await fixture.whenStable();
    fixture.componentInstance.form.setValue({ clientId: 'id', clientSecret: 'secret' });
    fixture.componentInstance.saveClient();
    backend
      .expectOne('/api/teacher/schedule/google/client')
      .flush(null, { status: 422, statusText: 'Unprocessable' });
    expect(navigation.go).not.toHaveBeenCalled();
  });

  it('stops waiting when the sync fails', async () => {
    setUp();
    const host = await render(googleStatus({ clientConfigured: true, status: 'CONNECTED' }));

    buttonByText(host, 'Синхронизировать сейчас').click();
    backend.expectOne('/api/teacher/schedule/google/sync').flush(null, { status: 500, statusText: 'Error' });
    await fixture.whenStable();

    expect(buttonByText(host, 'Синхронизировать сейчас').disabled).toBe(false);
  });
});
