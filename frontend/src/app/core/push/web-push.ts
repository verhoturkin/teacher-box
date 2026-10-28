import { HttpClient } from '@angular/common/http';
import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SwPush } from '@angular/service-worker';
import { Observable, catchError, from, map, of, switchMap, tap, throwError } from 'rxjs';
import { quietContext } from '@core/http/api-error.interceptor';
import { readDeviceSetting, writeDeviceSetting } from '@shared/storage/device-settings';

/** Mirrors `PushSubscriptionService.DeviceView`: the address of the device at the push service is not sent. */
export interface PushDevice {
  readonly id: string;
  readonly userAgent: string | null;
  readonly createdAt: string;
  readonly lastSuccessAt: string | null;
  /** The push service keeps refusing the device. */
  readonly failing: boolean;
}

/** Browser storage key: the id of the subscription of this browser (the list never shows addresses). */
export const PUSH_DEVICE_KEY = 'tb.push.device';

/**
 * Web push of the current user in this browser (ADR-0051): the public key, the subscription of the
 * browser (`SwPush`) and the user's devices. The permission prompt is asked only from {@link enable},
 * which the caller runs from a click: browsers (Safari first) refuse a prompt that is not a gesture.
 */
@Injectable({ providedIn: 'root' })
export class WebPush {
  private readonly http = inject(HttpClient);
  // Optional: without `provideServiceWorker` (tests, an old build) push is simply unsupported.
  private readonly swPush = inject(SwPush, { optional: true });
  private key: string | null = null;

  /** The browser can subscribe: a service worker, `PushManager` and notifications. */
  readonly supported =
    this.swPush?.isEnabled === true && 'PushManager' in window && 'Notification' in window;
  /** The browser tab of an iPhone or iPad: push works only in the app added to the Home Screen. */
  readonly needsHomeScreen =
    (navigator as Navigator & { standalone?: boolean }).standalone === false;
  /** The user (or the browser) refused notifications for this site. */
  readonly denied = signal(this.supported && Notification.permission === 'denied');
  /** The user's devices; `null` until loaded. */
  readonly devices = signal<PushDevice[] | null>(null);

  private readonly subscribed = signal(false);
  private readonly thisDevice = signal(readDeviceSetting(PUSH_DEVICE_KEY));

  /** This browser is subscribed and the account knows it; `false` while the devices load. */
  readonly enabledHere = computed(
    () => this.subscribed() && this.devices()?.some((d) => d.id === this.thisDevice()) === true,
  );

  constructor() {
    if (this.supported) {
      this.swPush?.subscription
        .pipe(takeUntilDestroyed(inject(DestroyRef)))
        .subscribe((subscription) => {
          this.subscribed.set(subscription !== null);
        });
    }
  }

  /** The device is this browser's subscription. */
  isThisDevice(device: PushDevice): boolean {
    return this.subscribed() && device.id === this.thisDevice();
  }

  /** Loads the devices and the public key, so that {@link enable} can ask for the permission at once. */
  load(): void {
    this.http
      .get<PushDevice[]>('/api/me/push/subscriptions', { context: quietContext() })
      .subscribe((devices) => {
        this.devices.set(devices);
      });
    if (this.supported && this.key === null) {
      this.http
        .get<{ key: string }>('/api/me/push/key', { context: quietContext() })
        .subscribe(({ key }) => {
          this.key = key;
        });
    }
  }

  /** Asks for the permission, subscribes this browser and registers it. Call from a click only. */
  enable(): Observable<PushDevice> {
    const swPush = this.swPush;
    if (swPush === null) {
      return throwError(() => new Error('Web push is not available'));
    }
    const key$ =
      this.key === null
        ? this.http.get<{ key: string }>('/api/me/push/key').pipe(map((response) => response.key))
        : of(this.key);
    return key$.pipe(
      switchMap((key) => from(swPush.requestSubscription({ serverPublicKey: key }))),
      switchMap((subscription) =>
        this.http.post<PushDevice>('/api/me/push/subscriptions', subscription.toJSON()),
      ),
      tap((device) => {
        writeDeviceSetting(PUSH_DEVICE_KEY, device.id);
        this.thisDevice.set(device.id);
        this.devices.update((list) => [...(list ?? []).filter((d) => d.id !== device.id), device]);
      }),
      catchError((error: unknown) => {
        this.denied.set(Notification.permission === 'denied');
        return throwError(() => error);
      }),
    );
  }

  /** Removes a device; this browser also drops its subscription so that the push service forgets it. */
  disable(device: PushDevice): Observable<unknown> {
    const own = this.isThisDevice(device);
    const unsubscribed = own && this.swPush ? this.swPush.unsubscribe() : Promise.resolve();
    return from(unsubscribed.catch(() => undefined)).pipe(
      switchMap(() => this.http.delete<unknown>(`/api/me/push/subscriptions/${device.id}`)),
      tap(() => {
        this.devices.update((list) => (list ?? []).filter((d) => d.id !== device.id));
      }),
    );
  }
}
