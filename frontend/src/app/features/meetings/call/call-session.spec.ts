import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { AuthService } from '@core/auth/auth.service';
import { authResponse } from '@testing/auth';
import { aParticipant as person } from '@testing/meetings-fixtures';
import { testProviders } from '@testing/setup';
import { CallDevices } from './call-devices';
import {
  AudioProcessing,
  CALL_ENGINE,
  CallConnection,
  CallEngine,
  CallMedia,
  CallSnapshot,
  CallStats,
  DEFAULT_AUDIO_PROCESSING,
} from './call-engine';
import { CallSession, END_TEXTS } from './call-session';

const MEDIA: CallMedia = { microphone: true, camera: false, microphoneId: null, cameraId: null };
const STATS: CallStats = {
  serverVersion: '1.13.7',
  transport: null,
  audioIn: null,
  audioOutLoss: null,
  videoOut: null,
  videoOutLimit: null,
  videoIn: null,
};

class FakeConnection implements CallConnection {
  readonly calls: string[] = [];
  failWith: Error | null = null;

  private act(call: string): Promise<void> {
    this.calls.push(call);
    const error = this.failWith;
    return error === null ? Promise.resolve() : Promise.reject(error);
  }

  setMicrophone(enabled: boolean) {
    return this.act(`mic ${String(enabled)}`);
  }
  setCamera(enabled: boolean) {
    return this.act(`camera ${String(enabled)}`);
  }
  setScreenShare(enabled: boolean) {
    return this.act(`screen ${String(enabled)}`);
  }
  switchDevice(kind: string, id: string) {
    return this.act(`switch ${kind} ${id}`);
  }
  setAudioProcessing(processing: AudioProcessing) {
    const flags = Object.values(processing).map((on) => (on ? '1' : '0'));
    return this.act(`processing ${flags.join('')}`);
  }
  stats(): Promise<CallStats> {
    return this.failWith === null ? Promise.resolve(STATS) : Promise.reject(this.failWith);
  }
  startAudio() {
    return this.act('startAudio');
  }
  leave() {
    return this.act('leave');
  }
}

class FakeEngine implements CallEngine {
  readonly connections: FakeConnection[] = [];
  readonly urls: string[] = [];
  update: (snapshot: CallSnapshot) => void = () => undefined;
  fail = false;

  connect(url: string, token: string, _media: CallMedia, onUpdate: (s: CallSnapshot) => void) {
    this.urls.push(`${url} ${token}`);
    if (this.fail) {
      return Promise.reject(new Error('down'));
    }
    this.update = onUpdate;
    const connection = new FakeConnection();
    this.connections.push(connection);
    return Promise.resolve(connection);
  }
}

describe('CallSession', () => {
  let session: CallSession;
  let backend: HttpTestingController;
  let engine: FakeEngine;
  let errors: string[];
  let remembered: CallMedia[];
  let processed: AudioProcessing[];

  beforeEach(() => {
    engine = new FakeEngine();
    remembered = [];
    processed = [];
    TestBed.configureTestingModule({
      providers: testProviders(
        { provide: CALL_ENGINE, useValue: () => Promise.resolve(engine) },
        {
          provide: CallDevices,
          useValue: {
            preferences: () => MEDIA,
            remember: (media: CallMedia) => remembered.push(media),
            audioProcessing: () => DEFAULT_AUDIO_PROCESSING,
            rememberAudioProcessing: (processing: AudioProcessing) => processed.push(processing),
          },
        },
      ),
    });
    session = TestBed.inject(CallSession);
    backend = TestBed.inject(HttpTestingController);
    errors = [];
    vi.spyOn(TestBed.inject(MessageService), 'add').mockImplementation((message) => {
      errors.push(String(message.detail));
    });
  });

  afterEach(() => {
    backend.verify();
  });

  function token(ownerId = 's-1', title = 'Мария'): void {
    backend
      .expectOne(`/api/meetings/calls/${ownerId}/token`)
      .flush({ token: `jwt-${ownerId}`, room: `tb-${ownerId}`, title });
  }

  /** Answers the token request once the session has sent it (after its awaits). */
  async function answer(ownerId: string): Promise<void> {
    for (let tries = 0; tries < 50; tries += 1) {
      const found = backend.match(`/api/meetings/calls/${ownerId}/token`);
      if (found.length > 0) {
        for (const request of found) {
          request.flush({ token: `jwt-${ownerId}`, room: `tb-${ownerId}`, title: 'Мария' });
        }
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    throw new Error(`no token request for ${ownerId}`);
  }

  async function joined(ownerId = 's-1'): Promise<FakeConnection> {
    session.open(ownerId);
    token(ownerId);
    const joining = session.join(MEDIA);
    await answer(ownerId);
    await joining;
    const connection = engine.connections.at(-1);
    if (connection === undefined) {
      throw new Error('not connected');
    }
    return connection;
  }

  function snapshot(overrides: Partial<CallSnapshot> = {}): CallSnapshot {
    return {
      state: 'connected',
      participants: [person()],
      audioBlocked: false,
      endReason: null,
      ...overrides,
    };
  }

  it('opens the pre-join sheet with the title of the room', () => {
    session.open('s-1');
    expect(session.opening()).toBe('s-1');
    session.open('s-1');
    token();

    expect(session.prejoin()).toEqual({ ownerId: 's-1', title: 'Мария' });
    expect(session.opening()).toBeNull();
    session.cancelPrejoin();
    expect(session.prejoin()).toBeNull();
  });

  it('says why a room does not open', () => {
    session.open('s-9');
    backend
      .expectOne('/api/meetings/calls/s-9/token')
      .flush(
        { status: 422, code: 'meetings.calls-disabled' },
        { status: 422, statusText: 'Unprocessable' },
      );

    expect(session.prejoin()).toBeNull();
    expect(errors).toHaveLength(1);
  });

  it('joins through the portal and turns the chosen devices on', async () => {
    const connection = await joined();

    expect(engine.urls).toEqual([`${location.origin}/livekit jwt-s-1`]);
    expect(remembered).toEqual([MEDIA]);
    expect(connection.calls).toEqual(['processing 111', 'mic true']);
    expect(session.phase()).toBe('connecting');
    engine.update(snapshot({ participants: [person(), person({ id: 's-1', local: false })] }));
    expect(session.phase()).toBe('connected');
    expect(session.target()).toEqual({ ownerId: 's-1', title: 'Мария' });
    expect(session.others().map((p) => p.id)).toEqual(['s-1']);
    expect(session.microphone()).toBe(true);
    expect(session.camera()).toBe(false);
    expect(session.startedAt()).not.toBeNull();
    expect(session.live()).toBe(true);
  });

  it('announces who came and who left', async () => {
    await joined();
    engine.update(snapshot());
    engine.update(snapshot({ participants: [person(), person({ id: 's-1', name: 'Анна' })] }));
    expect(session.announcement()).toBe('Анна в звонке');
    engine.update(snapshot());
    expect(session.announcement()).toBe('Анна вышел из звонка');
  });

  it('expands the call that is going on instead of joining again', async () => {
    await joined();
    session.minimize();
    expect(session.mode()).toBe('minimized');

    session.open('s-1');

    expect(session.mode()).toBe('expanded');
  });

  it('leaves the current call before joining another one', async () => {
    const first = await joined('s-1');
    await joined('g-1');

    expect(first.calls).toContain('leave');
    expect(session.target()?.ownerId).toBe('g-1');
  });

  it('says when the call could not start and opens it again', async () => {
    engine.fail = true;
    session.open('s-1');
    token();
    const joining = session.join(MEDIA);
    await answer('s-1');
    await joining;

    expect(session.phase()).toBe('ended');
    expect(session.endText()).toBe(END_TEXTS.failed);
    session.retry();
    expect(session.phase()).toBe('idle');
    token();
    expect(session.prejoin()?.ownerId).toBe('s-1');
  });

  it('ends when the server closes the room, and closes', async () => {
    await joined();
    session.minimize();
    engine.update(snapshot({ state: 'reconnecting' }));
    expect(session.phase()).toBe('reconnecting');

    engine.update(snapshot({ state: 'disconnected', endReason: 'removed' }));

    expect(session.phase()).toBe('ended');
    expect(session.mode()).toBe('expanded');
    expect(session.endText()).toBe(END_TEXTS.removed);
    session.close();
    expect(session.phase()).toBe('idle');
  });

  it('switches devices and reports what failed', async () => {
    const connection = await joined();
    engine.update(snapshot({ participants: [person({ microphone: true })] }));

    await session.toggleMicrophone();
    await session.toggleCamera();
    await session.toggleScreen();
    await session.switchDevice('videoinput', 'cam-2');
    await session.switchDevice('audioinput', 'mic-2');
    await session.startAudio();
    expect(connection.calls).toEqual([
      'processing 111',
      'mic true',
      'mic false',
      'camera true',
      'screen true',
      'switch videoinput cam-2',
      'switch audioinput mic-2',
      'startAudio',
    ]);
    expect(session.media()).toMatchObject({ cameraId: 'cam-2', microphoneId: 'mic-2' });

    const denied = new Error('denied');
    denied.name = 'NotAllowedError';
    connection.failWith = denied;
    await session.toggleScreen();
    expect(errors).toEqual([]);
    await session.toggleCamera();
    await session.startAudio();
    expect(errors).toEqual([
      'Браузер не дал доступ к камере и микрофону. Разрешите его в настройках сайта.',
      'Не удалось включить звук',
    ]);
  });

  it('changes the sound processing and reads the details of the connection', async () => {
    expect(await session.stats()).toBeNull();
    const connection = await joined();
    const quiet = { ...DEFAULT_AUDIO_PROCESSING, noiseSuppression: false };

    await session.setAudioProcessing(quiet);
    expect(connection.calls.at(-1)).toBe('processing 101');
    expect(session.audioProcessing()).toEqual(quiet);
    expect(processed).toEqual([quiet]);
    expect(await session.stats()).toEqual(STATS);

    connection.failWith = new Error('busy');
    await session.setAudioProcessing(DEFAULT_AUDIO_PROCESSING);
    expect(errors).toEqual(['Не удалось изменить обработку звука']);
    expect(await session.stats()).toBeNull();
  });

  it('keeps the call when a device fails at the start', async () => {
    engine.connect = (_url, _jwt, _media, onUpdate) => {
      const connection = new FakeConnection();
      connection.failWith = new Error('busy');
      engine.update = onUpdate;
      engine.connections.push(connection);
      return Promise.resolve(connection);
    };
    await joined();

    expect(errors).toEqual(['Не удалось включить камеру или микрофон.']);
    expect(session.live()).toBe(true);
  });

  it('leaves on sign-out and ignores actions without a call', async () => {
    await session.toggleMicrophone();
    await session.join(MEDIA);
    TestBed.inject(AuthService).acceptSession(authResponse('TEACHER'));
    TestBed.tick();
    const connection = await joined();
    TestBed.tick();
    expect(session.live()).toBe(true);
    vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    TestBed.inject(AuthService).logout().subscribe();
    backend.expectOne('/api/auth/logout').flush(null);
    TestBed.tick();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(connection.calls).toContain('leave');
    expect(session.phase()).toBe('idle');
  });

  it('asks before the page closes during a call', async () => {
    const quiet = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(quiet);
    expect(quiet.defaultPrevented).toBe(false);

    await joined();
    const asked = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(asked);
    expect(asked.defaultPrevented).toBe(true);
    await session.leave();
  });
});
