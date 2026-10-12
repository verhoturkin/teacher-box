import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { DriveStatus } from '../data-access/settings.models';
import { DRIVE_POLL_MS, DriveStore } from './drive-store';
import { testProviders } from '@testing/setup';

const URI = '/api/teacher/backups/google';
const NAME = 'teacherbox-20261012-033000-000.zip';

const STATUS: DriveStatus = {
  clientConfigured: true,
  clientFromEnvironment: false,
  clientId: 'id',
  connected: true,
  account: null,
  connectedAt: null,
  lastUploadAt: null,
  lastUploadName: null,
  lastError: null,
  running: null,
  callbackPath: '/api/public/backups/google/callback',
};

describe('DriveStore', () => {
  let store: DriveStore;
  let backend: HttpTestingController;

  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({ providers: testProviders() });
    store = TestBed.inject(DriveStore);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    store.cancel();
    backend.verify();
    vi.useRealTimers();
  });

  it('asks again while a copy comes to the server, then tells that it arrived', () => {
    store.load();
    backend.expectOne(URI).flush({ ...STATUS, running: { task: 'DOWNLOAD', name: NAME } });
    backend.expectOne(`${URI}/files`).flush([{ id: '1', name: NAME, size: 1, createdAt: null }]);
    expect(store.names().has(NAME)).toBe(true);

    vi.advanceTimersByTime(DRIVE_POLL_MS);
    backend.expectOne(URI).flush(STATUS);
    backend.expectOne(`${URI}/files`).flush([]);

    expect(store.arrived()).toBe(1);
    vi.advanceTimersByTime(DRIVE_POLL_MS);
    backend.expectNone(URI);
  });

  it('does not count a finished upload as an arrival', () => {
    store.load();
    backend.expectOne(URI).flush({ ...STATUS, running: { task: 'UPLOAD', name: NAME } });
    backend.expectOne(`${URI}/files`).flush([]);
    vi.advanceTimersByTime(DRIVE_POLL_MS);
    backend.expectOne(URI).flush(STATUS);
    backend.expectOne(`${URI}/files`).flush([]);

    expect(store.arrived()).toBe(0);
  });

  it('forgets the copies without a connection and stops asking when cancelled', () => {
    store.files.set([{ id: '1', name: NAME, size: 1, createdAt: null }]);
    store.load();
    backend.expectOne(URI).flush({
      ...STATUS,
      connected: false,
      running: { task: 'UPLOAD', name: NAME },
    });

    expect(store.files()).toEqual([]);
    expect(store.connected()).toBe(false);
    store.cancel();
    vi.advanceTimersByTime(DRIVE_POLL_MS);
    backend.expectNone(URI);
  });
});
