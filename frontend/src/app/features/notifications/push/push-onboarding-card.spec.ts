import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SwPush } from '@angular/service-worker';
import { BehaviorSubject } from 'rxjs';
import { PUSH_DEVICE_KEY, PushDevice } from '@core/push/web-push';
import { Snackbar } from '@core/snackbar/snackbar';
import { buttonByText, hostElement, readableText } from '@testing/dom';
import { testProviders } from '@testing/setup';
import { PUSH_DISMISSED_KEY, PushOnboardingCard } from './push-onboarding-card';

const DEVICE: PushDevice = {
  id: 'd1',
  userAgent: null,
  createdAt: '2026-10-28T10:00:00Z',
  lastSuccessAt: null,
  failing: false,
};

describe('PushOnboardingCard', () => {
  const subscription = new BehaviorSubject<unknown>(null);
  const requestSubscription = vi.fn();
  let fixture: ComponentFixture<PushOnboardingCard>;
  let backend: HttpTestingController;

  async function render(
    devices: PushDevice[],
    options: { enabled?: boolean; permission?: string; teacher?: boolean } = {},
  ): Promise<void> {
    vi.stubGlobal('PushManager', () => undefined);
    vi.stubGlobal('Notification', { permission: options.permission ?? 'default' });
    TestBed.configureTestingModule({
      imports: [PushOnboardingCard],
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
    fixture = TestBed.createComponent(PushOnboardingCard);
    fixture.componentRef.setInput('teacher', options.teacher ?? false);
    fixture.detectChanges();
    const list = backend.match('/api/me/push/subscriptions');
    list.forEach((request) => {
      request.flush(devices);
    });
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

  it('offers notifications to a student and turns them on', async () => {
    await render([]);
    const success = vi.spyOn(TestBed.inject(Snackbar), 'success');
    expect(text()).toContain('Уведомления на этом устройстве');
    expect(text()).toContain('Напоминания о занятиях');

    buttonByText(hostElement(fixture), 'Включить').click();
    const request = await vi.waitFor(() => backend.expectOne('/api/me/push/subscriptions'));
    request.flush(DEVICE);
    subscription.next({});
    fixture.detectChanges();

    expect(success).toHaveBeenCalledWith('Уведомления на этом устройстве включены');
    expect(text()).toBe('');
  });

  it('names what the teacher gets', async () => {
    await render([], { teacher: true });

    expect(text()).toContain('Сданные работы');
  });

  it('says why it failed', async () => {
    await render([]);
    const error = vi.spyOn(TestBed.inject(Snackbar), 'error');
    requestSubscription.mockRejectedValue(new Error('boom'));

    buttonByText(hostElement(fixture), 'Включить').click();

    await vi.waitFor(() => {
      expect(error).toHaveBeenCalledWith('Не удалось включить уведомления');
    });
  });

  it('is hidden once the notifications are on, blocked or postponed', async () => {
    localStorage.setItem(PUSH_DEVICE_KEY, 'd1');
    subscription.next({});
    await render([DEVICE]);
    expect(text()).toBe('');
  });

  it('is hidden in a browser that blocks notifications and in one without a worker', async () => {
    await render([], { permission: 'denied' });
    expect(text()).toBe('');

    fixture.destroy();
    TestBed.resetTestingModule();
    await render([], { enabled: false });
    expect(text()).toBe('');
  });

  it('is hidden after «Не сейчас» for good', async () => {
    await render([]);

    buttonByText(hostElement(fixture), 'Не сейчас').click();
    fixture.detectChanges();

    expect(text()).toBe('');
    expect(localStorage.getItem(PUSH_DISMISSED_KEY)).toBe('1');

    fixture.destroy();
    TestBed.resetTestingModule();
    await render([]);
    backend.expectNone('/api/me/push/subscriptions');
    expect(text()).toBe('');
  });

  it('explains the Home Screen in an iPhone tab', async () => {
    Object.defineProperty(navigator, 'standalone', { value: false, configurable: true });
    await render([]);

    expect(text()).toContain('Добавьте на экран Домой');
    expect(text()).not.toContain('Включить');

    buttonByText(hostElement(fixture), 'Понятно').click();
    fixture.detectChanges();
    expect(text()).toBe('');
  });
});
