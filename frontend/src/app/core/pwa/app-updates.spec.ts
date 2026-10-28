import type { Mock } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { SwUpdate, VersionEvent } from '@angular/service-worker';
import { MessageService } from 'primeng/api';
import { Subject } from 'rxjs';
import { Snackbar } from '@core/snackbar/snackbar';
import { AppUpdates } from './app-updates';

describe('AppUpdates', () => {
  const events = new Subject<VersionEvent>();
  const activateUpdate = vi.fn(() => Promise.resolve(true));
  let isEnabled: boolean;
  let action: Mock<Snackbar['action']>;

  function start(): void {
    TestBed.configureTestingModule({
      providers: [
        MessageService,
        { provide: SwUpdate, useValue: { isEnabled, versionUpdates: events, activateUpdate } },
      ],
    });
    action = vi.spyOn(TestBed.inject(Snackbar), 'action').mockImplementation(() => undefined);
    TestBed.inject(AppUpdates).start();
  }

  beforeEach(() => {
    isEnabled = true;
    activateUpdate.mockClear();
  });

  it('offers «Обновить» when a new version is ready and ignores other events', () => {
    start();

    events.next({ type: 'VERSION_DETECTED', version: { hash: 'a' } });
    events.next({ type: 'NO_NEW_VERSION_DETECTED', version: { hash: 'a' } });
    expect(action).not.toHaveBeenCalled();
    events.next({
      type: 'VERSION_READY',
      currentVersion: { hash: 'a' },
      latestVersion: { hash: 'b' },
    });

    expect(action).toHaveBeenCalledWith('Доступна новая версия', 'Обновить', expect.any(Function));
  });

  it('activates the update when «Обновить» is pressed', () => {
    start();
    events.next({
      type: 'VERSION_READY',
      currentVersion: { hash: 'a' },
      latestVersion: { hash: 'b' },
    });
    action.mock.calls[0]?.[2]();

    expect(activateUpdate).toHaveBeenCalledOnce();
  });

  it('does nothing without a service worker', () => {
    isEnabled = false;
    start();

    events.next({
      type: 'VERSION_READY',
      currentVersion: { hash: 'a' },
      latestVersion: { hash: 'b' },
    });

    expect(action).not.toHaveBeenCalled();
  });
});
