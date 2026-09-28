import { Clipboard } from '@angular/cdk/clipboard';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { MessageService } from 'primeng/api';
import { providePrimeNG } from 'primeng/config';
import { Portal } from '@core/portal/portal';
import { ExternalNavigation } from '@shared/navigation/external-navigation';
import { buttonByText, hostElement, readableText, requireElement } from '@testing/dom';
import { yandexStatus } from '@testing/meetings-fixtures';
import { YandexStatus } from '../data-access/meetings.models';
import { MeetingPreferences } from '../telemost';
import { MeetingsSettingsPanel } from './meetings-settings-panel';

describe('MeetingsSettingsPanel', () => {
  let fixture: ComponentFixture<MeetingsSettingsPanel>;
  let backend: HttpTestingController;
  let navigation: { go: ReturnType<typeof vi.fn>; origin: () => string };

  async function render(status: YandexStatus, result: string | null = null): Promise<string> {
    navigation = { go: vi.fn(), origin: () => 'https://school.example.com' };
    TestBed.configureTestingModule({
      imports: [MeetingsSettingsPanel],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        providePrimeNG(),
        MessageService,
        { provide: ExternalNavigation, useValue: navigation },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: convertToParamMap(result === null ? {} : { yandex: result }),
            },
          },
        },
      ],
    });
    backend = TestBed.inject(HttpTestingController);
    TestBed.inject(Portal).set({ name: 'Teacher Box', address: 'https://school.example.com' });
    fixture = TestBed.createComponent(MeetingsSettingsPanel);
    fixture.detectChanges();
    backend.expectOne('/api/teacher/meetings/yandex').flush(status);
    await fixture.whenStable();
    return readableText(hostElement(fixture));
  }

  afterEach(() => {
    backend.verify();
    fixture.destroy();
  });

  it('guides through the application in Yandex ID', async () => {
    const text = await render(yandexStatus());
    const copy = vi.spyOn(TestBed.inject(Clipboard), 'copy').mockReturnValue(true);

    expect(text).toContain('oauth.yandex.ru');
    expect(text).toContain('https://school.example.com/api/public/meetings/yandex/callback');
    buttonByText(hostElement(fixture), 'Копировать адрес').click();
    expect(copy).toHaveBeenCalledWith(
      'https://school.example.com/api/public/meetings/yandex/callback',
    );

    fixture.componentInstance.form.setValue({ clientId: ' id ', clientSecret: ' secret ' });
    fixture.componentInstance.saveClient();
    const save = backend.expectOne('/api/teacher/meetings/yandex/client');
    expect(save.request.body).toEqual({ clientId: 'id', clientSecret: 'secret' });
    save.flush(yandexStatus({ clientConfigured: true, clientId: 'id' }));
    await fixture.whenStable();

    buttonByText(hostElement(fixture), 'Подключить Яндекс').click();
    backend
      .expectOne('/api/teacher/meetings/yandex/authorize')
      .flush({ url: 'https://oauth.yandex.ru/authorize?x' });
    expect(navigation.go).toHaveBeenCalledWith('https://oauth.yandex.ru/authorize?x');
  });

  it('shows the connection and disconnects', async () => {
    const text = await render(
      yandexStatus({ status: 'CONNECTED', connectedAt: '2026-09-27T10:00:00Z' }),
      'connected',
    );

    expect(text).toContain('Яндекс подключён: комнаты можно создавать кнопкой');
    expect(text).toContain('Яндекс подключён с 27.09.2026');
    buttonByText(hostElement(fixture), 'Отключить').click();
    backend.expectOne({ method: 'DELETE', url: '/api/teacher/meetings/yandex' }).flush(null);
    backend.expectOne('/api/teacher/meetings/yandex').flush(yandexStatus());
    await fixture.whenStable();

    expect(readableText(hostElement(fixture))).not.toContain('Яндекс подключён: комнаты');
  });

  it('asks to reconnect and keeps the chosen options', async () => {
    const text = await render(
      yandexStatus({
        status: 'NEEDS_RECONNECT',
        clientConfigured: true,
        lastError: 'invalid_grant',
      }),
      'expired',
    );

    expect(text).toContain('Подключите аккаунт заново');
    expect(text).toContain('invalid_grant');
    expect(text).toContain('Ссылка подключения устарела');
    buttonByText(hostElement(fixture), 'Изменить приложение').click();
    await fixture.whenStable();
    buttonByText(hostElement(fixture), 'Отмена').click();

    fixture.componentInstance.setWaitingRoom(true);
    backend
      .expectOne('/api/teacher/meetings/yandex/waiting-room')
      .flush(yandexStatus({ waitingRoom: true }));
    fixture.componentInstance.setOpenInApp(false);
    expect(TestBed.inject(MeetingPreferences).openInApp()).toBe(false);
    await fixture.whenStable();
    expect(
      requireElement(hostElement(fixture), '#meetings-waiting-room', HTMLInputElement).checked,
    ).toBe(true);
  });

  it('shows a token from the environment and failed connections', async () => {
    const text = await render(
      yandexStatus({ tokenFromEnvironment: true, status: 'CONNECTED' }),
      'unknown',
    );
    expect(text).toContain('токеном из переменных окружения сервера');

    fixture.componentInstance.connect();
    backend
      .expectOne('/api/teacher/meetings/yandex/authorize')
      .flush(null, { status: 422, statusText: 'x' });
    fixture.componentInstance.form.setValue({ clientId: 'a', clientSecret: 'b' });
    fixture.componentInstance.saveClient();
    backend
      .expectOne('/api/teacher/meetings/yandex/client')
      .flush(null, { status: 500, statusText: 'x' });
    fixture.componentInstance.form.setValue({ clientId: '', clientSecret: '' });
    fixture.componentInstance.saveClient();
    backend.expectNone('/api/teacher/meetings/yandex/client');
  });
});
