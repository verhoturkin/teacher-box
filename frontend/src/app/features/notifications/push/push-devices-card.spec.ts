import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SwPush } from '@angular/service-worker';
import { BehaviorSubject } from 'rxjs';
import { PUSH_DEVICE_KEY, PushDevice } from '@core/push/web-push';
import { Snackbar } from '@core/snackbar/snackbar';
import { buttonByText, hostElement, readableText } from '@testing/dom';
import { testProviders } from '@testing/setup';
import { PushDevicesCard } from './push-devices-card';

const THIS_DEVICE: PushDevice = {
  id: 'd1',
  userAgent: 'Mozilla/5.0 (Windows NT 10.0) Chrome/130.0 Safari/537',
  createdAt: '2026-10-28T10:00:00Z',
  lastSuccessAt: null,
  failing: false,
};
const OTHER: PushDevice = { ...THIS_DEVICE, id: 'd2', userAgent: null, failing: true };

describe('PushDevicesCard', () => {
  const subscription = new BehaviorSubject<unknown>(null);
  const requestSubscription = vi.fn();
  let fixture: ComponentFixture<PushDevicesCard>;
  let backend: HttpTestingController;

  async function render(
    devices: PushDevice[],
    options: { enabled?: boolean; permission?: string } = {},
  ): Promise<void> {
    vi.stubGlobal('PushManager', () => undefined);
    vi.stubGlobal('Notification', { permission: options.permission ?? 'default' });
    TestBed.configureTestingModule({
      imports: [PushDevicesCard],
      providers: testProviders({
        provide: SwPush,
        useValue: {
          isEnabled: options.enabled ?? true,
          subscription,
          requestSubscription,
          unsubscribe: () => Promise.resolve(),
        },
      }),
    });
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(PushDevicesCard);
    fixture.detectChanges();
    backend.expectOne('/api/me/push/subscriptions').flush(devices);
    backend.match('/api/me/push/key').forEach((request) => {
      request.flush({ key: 'KEY' });
    });
    fixture.detectChanges();
    await fixture.whenStable();
  }

  function text(): string {
    return readableText(hostElement(fixture));
  }

  beforeEach(() => {
    subscription.next(null);
    requestSubscription.mockReset();
    requestSubscription.mockResolvedValue({
      toJSON: () => ({ endpoint: 'https://push/1', keys: { p256dh: 'p', auth: 'a' } }),
    });
  });

  afterEach(() => {
    fixture.destroy();
    backend.verify();
    localStorage.clear();
    vi.unstubAllGlobals();
    Object.defineProperty(navigator, 'standalone', { value: undefined, configurable: true });
    vi.restoreAllMocks();
  });

  it('offers to turn notifications on and lists the devices without the ones of others', async () => {
    await render([OTHER]);

    expect(text()).toContain('Уведомления на устройствах');
    expect(text()).toContain('Включить уведомления на этом устройстве');
    expect(text()).toContain('Устройство');
    expect(text()).toContain('уведомления не доходят');
    expect(text()).not.toContain('это устройство');
  });

  it('turns notifications on from the button and marks this device', async () => {
    await render([]);
    const success = vi.spyOn(TestBed.inject(Snackbar), 'success');

    buttonByText(hostElement(fixture), 'Включить уведомления на этом устройстве').click();
    const request = await vi.waitFor(() => backend.expectOne('/api/me/push/subscriptions'));
    request.flush(THIS_DEVICE);
    subscription.next({});
    fixture.detectChanges();
    await fixture.whenStable();

    expect(requestSubscription).toHaveBeenCalledWith({ serverPublicKey: 'KEY' });
    expect(success).toHaveBeenCalledWith('Уведомления на этом устройстве включены');
    expect(text()).toContain('Chrome · Windows');
    expect(text()).toContain('это устройство');
    expect(text()).not.toContain('Включить уведомления на этом устройстве');
  });

  it('says why it failed when the permission is refused', async () => {
    await render([]);
    const error = vi.spyOn(TestBed.inject(Snackbar), 'error');
    requestSubscription.mockRejectedValue(new Error('NotAllowedError'));
    vi.stubGlobal('Notification', { permission: 'denied' });

    buttonByText(hostElement(fixture), 'Включить уведомления на этом устройстве').click();
    await vi.waitFor(() => {
      expect(error).toHaveBeenCalled();
    });
    fixture.detectChanges();

    expect(error.mock.calls[0]?.[0]).toContain('Браузер запретил уведомления');
    expect(text()).toContain('Браузер запретил уведомления');
  });

  it('says a plain failure when the subscription breaks for another reason', async () => {
    await render([]);
    const error = vi.spyOn(TestBed.inject(Snackbar), 'error');
    requestSubscription.mockRejectedValue(new Error('push service error'));

    buttonByText(hostElement(fixture), 'Включить уведомления на этом устройстве').click();
    await vi.waitFor(() => {
      expect(error).toHaveBeenCalledWith('Не удалось включить уведомления');
    });
  });

  it('turns a device off', async () => {
    localStorage.setItem(PUSH_DEVICE_KEY, 'd1');
    await render([THIS_DEVICE, OTHER]);
    const info = vi.spyOn(TestBed.inject(Snackbar), 'info');

    buttonByText(hostElement(fixture), 'Отключить').click();
    const request = await vi.waitFor(() => backend.expectOne('/api/me/push/subscriptions/d1'));
    request.flush(null);
    fixture.detectChanges();

    expect(info).toHaveBeenCalledWith('Устройство отключено');
    expect(text()).not.toContain('Chrome · Windows');
  });

  it('explains that the browser cannot show notifications', async () => {
    await render([], { enabled: false });

    expect(text()).toContain('не поддерживает уведомления');
    expect(text()).not.toContain('Включить уведомления на этом устройстве');
  });

  it('tells a blocked site to allow notifications', async () => {
    await render([], { permission: 'denied' });

    expect(text()).toContain('Браузер запретил уведомления');
  });

  it('asks an iPhone tab to add the portal to the Home Screen', async () => {
    Object.defineProperty(navigator, 'standalone', { value: false, configurable: true });
    await render([]);

    expect(text()).toContain('Добавьте на экран Домой');
    expect(text()).not.toContain('Включить уведомления на этом устройстве');
  });
});
