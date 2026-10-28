import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { SwPush } from '@angular/service-worker';
import { BehaviorSubject } from 'rxjs';
import { testProviders } from '@testing/setup';
import { PUSH_DEVICE_KEY, PushDevice, WebPush } from './web-push';

const DEVICE: PushDevice = {
  id: 'd1',
  userAgent: 'Chrome',
  createdAt: '2026-10-28T10:00:00Z',
  lastSuccessAt: null,
  failing: false,
};

describe('WebPush', () => {
  const subscription = new BehaviorSubject<unknown>(null);
  const requestSubscription = vi.fn();
  const unsubscribe = vi.fn(() => Promise.resolve());
  let backend: HttpTestingController;

  function create(options: { enabled?: boolean; permission?: string } = {}): WebPush {
    vi.stubGlobal('PushManager', () => undefined);
    vi.stubGlobal('Notification', { permission: options.permission ?? 'default' });
    TestBed.configureTestingModule({
      providers: testProviders({
        provide: SwPush,
        useValue: {
          isEnabled: options.enabled ?? true,
          subscription,
          requestSubscription,
          unsubscribe,
        },
      }),
    });
    backend = TestBed.inject(HttpTestingController);
    return TestBed.inject(WebPush);
  }

  function load(push: WebPush, devices: PushDevice[]): void {
    push.load();
    backend.expectOne('/api/me/push/subscriptions').flush(devices);
    backend.expectOne('/api/me/push/key').flush({ key: 'KEY' });
  }

  beforeEach(() => {
    subscription.next(null);
    requestSubscription.mockReset();
    unsubscribe.mockClear();
    requestSubscription.mockResolvedValue({
      toJSON: () => ({ endpoint: 'https://push/1', keys: { p256dh: 'p', auth: 'a' } }),
    });
  });

  afterEach(() => {
    backend.verify();
    localStorage.clear();
    vi.unstubAllGlobals();
    Object.defineProperty(navigator, 'standalone', { value: undefined, configurable: true });
  });

  it('is unsupported without a service worker and loads only the devices', () => {
    const push = create({ enabled: false });

    expect(push.supported).toBe(false);
    push.load();
    backend.expectOne('/api/me/push/subscriptions').flush([]);
    backend.expectNone('/api/me/push/key');
    expect(push.devices()).toEqual([]);
  });

  it('is unsupported without a service worker provider at all', () => {
    vi.stubGlobal('PushManager', () => undefined);
    TestBed.configureTestingModule({ providers: testProviders() });
    backend = TestBed.inject(HttpTestingController);
    const push = TestBed.inject(WebPush);

    expect(push.supported).toBe(false);
    let failure: unknown;
    push.enable().subscribe({
      error: (error: unknown) => {
        failure = error;
      },
    });
    expect(failure).toBeInstanceOf(Error);
  });

  it('knows that notifications are denied', () => {
    expect(create({ permission: 'denied' }).denied()).toBe(true);
  });

  it('asks for the home screen on an iPhone tab, never in the installed app', () => {
    Object.defineProperty(navigator, 'standalone', { value: false, configurable: true });
    expect(create().needsHomeScreen).toBe(true);

    TestBed.resetTestingModule();
    Object.defineProperty(navigator, 'standalone', { value: true, configurable: true });
    expect(create().needsHomeScreen).toBe(false);
  });

  it('subscribes the browser from the cached key and registers the device', async () => {
    const push = create();
    load(push, []);
    expect(push.enabledHere()).toBe(false);

    let result: PushDevice | undefined;
    push.enable().subscribe((device) => {
      result = device;
    });
    await vi.waitFor(() => {
      expect(requestSubscription).toHaveBeenCalledWith({ serverPublicKey: 'KEY' });
    });
    const request = await vi.waitFor(() => backend.expectOne('/api/me/push/subscriptions'));
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      endpoint: 'https://push/1',
      keys: { p256dh: 'p', auth: 'a' },
    });
    request.flush(DEVICE);
    subscription.next({});

    expect(result).toEqual(DEVICE);
    expect(localStorage.getItem(PUSH_DEVICE_KEY)).toBe('d1');
    expect(push.devices()).toEqual([DEVICE]);
    expect(push.enabledHere()).toBe(true);
    expect(push.isThisDevice(DEVICE)).toBe(true);
  });

  it('fetches the key itself when it is not cached and replaces a device registered again', async () => {
    const push = create();
    push.devices.set([{ ...DEVICE, failing: true }]);

    push.enable().subscribe();
    backend.expectOne('/api/me/push/key').flush({ key: 'K2' });
    const request = await vi.waitFor(() => backend.expectOne('/api/me/push/subscriptions'));
    request.flush(DEVICE);

    expect(requestSubscription).toHaveBeenCalledWith({ serverPublicKey: 'K2' });
    expect(push.devices()).toEqual([DEVICE]);
  });

  it('remembers a refusal of the permission', async () => {
    const push = create();
    load(push, []);
    requestSubscription.mockRejectedValue(new Error('NotAllowedError'));
    vi.stubGlobal('Notification', { permission: 'denied' });
    let failed = false;

    push.enable().subscribe({
      error: () => {
        failed = true;
      },
    });

    await vi.waitFor(() => {
      expect(failed).toBe(true);
    });
    expect(push.denied()).toBe(true);
  });

  it('does not take a subscription of another user in this browser for this one', () => {
    localStorage.setItem(PUSH_DEVICE_KEY, 'other');
    const push = create();
    subscription.next({});
    load(push, [DEVICE]);

    expect(push.enabledHere()).toBe(false);
    expect(push.isThisDevice(DEVICE)).toBe(false);
  });

  it('removes another device without touching the browser subscription', async () => {
    const push = create();
    load(push, [DEVICE]);

    push.disable(DEVICE).subscribe();
    const request = await vi.waitFor(() => backend.expectOne('/api/me/push/subscriptions/d1'));
    expect(request.request.method).toBe('DELETE');
    request.flush(null);

    expect(unsubscribe).not.toHaveBeenCalled();
    expect(push.devices()).toEqual([]);
  });

  it('drops the browser subscription of this device and survives a failing unsubscribe', async () => {
    localStorage.setItem(PUSH_DEVICE_KEY, 'd1');
    unsubscribe.mockRejectedValueOnce(new Error('no subscription'));
    const push = create();
    subscription.next({});
    load(push, [DEVICE]);

    push.disable(DEVICE).subscribe();
    const request = await vi.waitFor(() => backend.expectOne('/api/me/push/subscriptions/d1'));
    request.flush(null);

    expect(unsubscribe).toHaveBeenCalled();
    expect(push.devices()).toEqual([]);
  });
});
