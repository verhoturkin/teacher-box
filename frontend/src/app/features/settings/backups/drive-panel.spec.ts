import { Clipboard } from '@angular/cdk/clipboard';
import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { MessageService } from 'primeng/api';
import { buttonByText, hostElement, readableText } from '@testing/dom';
import { Portal } from '@core/portal/portal';
import { ExternalNavigation } from '@shared/navigation/external-navigation';
import { CloudBackup, DriveStatus } from '../data-access/settings.models';
import { DrivePanel } from './drive-panel';
import { DriveStore } from './drive-store';
import { testProviders } from '@testing/setup';
import { portalInfo } from '@testing/portal-fixtures';

const URI = '/api/teacher/backups/google';
const NAME = 'teacherbox-20261012-033000-000.zip';
const FILE: CloudBackup = { id: 'f1', name: NAME, size: 2_621_440, createdAt: null };

function driveStatus(overrides: Partial<DriveStatus> = {}): DriveStatus {
  return {
    clientConfigured: false,
    clientFromEnvironment: false,
    clientId: null,
    connected: false,
    account: null,
    connectedAt: null,
    lastUploadAt: null,
    lastUploadName: null,
    lastError: null,
    running: null,
    callbackPath: '/api/public/backups/google/callback',
    ...overrides,
  };
}

const CONNECTED = driveStatus({
  clientConfigured: true,
  clientId: 'id',
  connected: true,
  account: 'teacher@example.com',
  connectedAt: '2026-10-01T10:00:00Z',
  lastUploadAt: '2026-10-12T00:30:10Z',
  lastUploadName: NAME,
});

describe('DrivePanel', () => {
  let fixture: ComponentFixture<DrivePanel>;
  let backend: HttpTestingController;
  let navigation: ExternalNavigation;

  function setUp(result: string | null = null): void {
    TestBed.configureTestingModule({
      imports: [DrivePanel],
      providers: testProviders({
        provide: ActivatedRoute,
        useValue: {
          snapshot: { queryParamMap: convertToParamMap(result === null ? {} : { drive: result }) },
        },
      }),
    });
    backend = TestBed.inject(HttpTestingController);
    navigation = TestBed.inject(ExternalNavigation);
    vi.spyOn(navigation, 'origin').mockReturnValue('https://school.example.com');
    vi.spyOn(navigation, 'go').mockImplementation(() => undefined);
    TestBed.inject(Portal).set(
      portalInfo({ name: 'Уроки Марии', address: 'https://school.example.com' }),
    );
    vi.spyOn(TestBed.inject(MessageService), 'add');
    fixture = TestBed.createComponent(DrivePanel);
  }

  afterEach(() => {
    backend.verify();
    fixture.destroy();
  });

  async function render(status: DriveStatus, files: CloudBackup[] = []): Promise<HTMLElement> {
    fixture.detectChanges();
    backend.expectOne(URI).flush(status);
    if (status.connected) {
      backend.expectOne(`${URI}/files`).flush(files);
    }
    await fixture.whenStable();
    return hostElement(fixture);
  }

  it('guides through the Google Cloud setup, saves the client and connects', async () => {
    setUp();
    const host = await render(driveStatus());
    const text = readableText(host);
    expect(text).toContain('Google Drive API');
    expect(text).toContain('https://school.example.com/api/public/backups/google/callback');

    buttonByText(host, 'Сохранить').click();
    backend.expectNone(`${URI}/client`);
    fixture.componentInstance.form.setValue({ clientId: ' id-1 ', clientSecret: 'secret' });
    await fixture.whenStable();
    buttonByText(host, 'Сохранить').click();
    const request = backend.expectOne({ method: 'PUT', url: `${URI}/client` });
    expect(request.request.body).toEqual({ clientId: 'id-1', clientSecret: 'secret' });
    request.flush(driveStatus({ clientConfigured: true, clientId: 'id-1' }));
    await fixture.whenStable();
    expect(readableText(host)).toContain('папку «Уроки Марии»');

    buttonByText(host, 'Подключить Google Диск').click();
    const authorize = backend.expectOne({ method: 'POST', url: `${URI}/authorize` });
    expect(authorize.request.body).toEqual({ origin: 'https://school.example.com' });
    authorize.flush({ url: 'https://accounts.google.com/consent' });
    expect(navigation.go).toHaveBeenCalledWith('https://accounts.google.com/consent');
  });

  it('keeps the form when saving fails and lets the client be changed', async () => {
    setUp();
    const host = await render(driveStatus({ clientConfigured: true, clientId: 'id' }));

    buttonByText(host, 'Изменить OAuth-клиент').click();
    await fixture.whenStable();
    fixture.componentInstance.form.setValue({ clientId: 'id-2', clientSecret: 'secret' });
    fixture.componentInstance.saveClient();
    backend
      .expectOne(`${URI}/client`)
      .flush(null, { status: 422, statusText: 'Unprocessable Content' });
    await fixture.whenStable();
    expect(fixture.componentInstance.form.getRawValue().clientId).toBe('id-2');

    buttonByText(host, 'Отмена').click();
    await fixture.whenStable();
    fixture.componentInstance.connect();
    backend.expectOne(`${URI}/authorize`).flush(null, { status: 500, statusText: 'Error' });
    await fixture.whenStable();
    expect(buttonByText(host, 'Подключить Google Диск').disabled).toBe(false);
  });

  it('hides the client form when the client comes from the environment', async () => {
    setUp();
    const host = await render(
      driveStatus({ clientConfigured: true, clientFromEnvironment: true, clientId: 'env' }),
    );

    expect(() => buttonByText(host, 'Изменить OAuth-клиент')).toThrow();
  });

  it('shows the result of the redirect and a lost connection', async () => {
    setUp('expired');
    const host = await render(
      driveStatus({ clientConfigured: true, clientId: 'id', lastError: 'invalid_grant' }),
    );

    const text = readableText(host);
    expect(text).toContain('Ссылка подключения устарела');
    expect(text).toContain('Google больше не принимает доступ портала');
    expect(text).toContain('invalid_grant');
  });

  it('ignores an unknown result', async () => {
    setUp('weird');
    const host = await render(driveStatus());

    expect(readableText(host)).not.toContain('Google Диск подключён');
  });

  it('shows the connection, the copies in the Drive and brings one to the server', async () => {
    setUp('connected');
    TestBed.inject(DriveStore).local.set(new Set(['teacherbox-20261011-033000-000.zip']));
    const other: CloudBackup = { ...FILE, id: 'f0', name: 'teacherbox-20261011-033000-000.zip' };
    const host = await render({ ...CONNECTED, lastError: 'quota exceeded' }, [FILE, other]);

    const text = readableText(host);
    expect(text).toContain('Google Диск подключён');
    expect(text).toContain('Аккаунт: teacher@example.com');
    expect(text).toContain(`Последняя копия в Диске: 12.10.2026`);
    expect(text).toContain('quota exceeded');
    expect(text).toContain('2,5 МБ · есть на сервере');
    expect(buttonByText(host, `Перенести на сервер: ${other.name}`).disabled).toBe(true);

    buttonByText(host, `Перенести на сервер: ${NAME}`).click();
    backend.expectOne({ method: 'POST', url: `${URI}/files/f1/download` }).flush(FILE);
    expect(TestBed.inject(MessageService).add).toHaveBeenCalled();
    backend.expectOne(URI).flush({ ...CONNECTED, running: { task: 'DOWNLOAD', name: NAME } });
    backend.expectOne(`${URI}/files`).flush([FILE]);
    await fixture.whenStable();
    expect(readableText(host)).toContain(`Копия ${NAME} переносится на сервер…`);
  });

  it('shows an upload and an empty Drive', async () => {
    setUp();
    const host = await render({
      ...CONNECTED,
      account: null,
      running: { task: 'UPLOAD', name: NAME },
    });

    expect(readableText(host)).toContain(`Копия ${NAME} отправляется в Google Диск…`);
    expect(readableText(host)).toContain('В Google Диске пока нет копий');
    expect(readableText(host)).not.toContain('Аккаунт');
  });

  it('disconnects', async () => {
    setUp('connected');
    const host = await render(CONNECTED);

    buttonByText(host, 'Отключить').click();
    backend.expectOne({ method: 'DELETE', url: URI }).flush(null);
    backend.expectOne(URI).flush(driveStatus({ clientConfigured: true, clientId: 'id' }));
    await fixture.whenStable();

    expect(readableText(host)).toContain('Подключить Google Диск');
    expect(readableText(host)).not.toContain('Google Диск подключён');
  });

  it('copies the redirect address', async () => {
    setUp();
    const clipboard = TestBed.inject(Clipboard);
    const copy = vi.spyOn(clipboard, 'copy').mockReturnValue(true);
    const host = await render(driveStatus());

    buttonByText(host, 'Копировать адрес').click();

    expect(copy).toHaveBeenCalledWith(
      'https://school.example.com/api/public/backups/google/callback',
    );
    expect(TestBed.inject(MessageService).add).toHaveBeenCalled();
  });
});
