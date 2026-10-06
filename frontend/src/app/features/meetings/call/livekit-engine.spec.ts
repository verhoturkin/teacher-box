import { CallMedia, CallSnapshot, DEFAULT_AUDIO_PROCESSING } from './call-engine';
import { StatsReport } from './call-stats';
import {
  LiveKitModule,
  LkAudioCapture,
  LkLocalParticipant,
  LkParticipant,
  LkPublication,
  LkRoom,
  LkRoomOptions,
  LkTrack,
  createLiveKitEngine,
  endReason,
} from './livekit-engine';

class FakeTrack implements LkTrack {
  readonly attached: HTMLMediaElement[] = [];
  getRTCStatsReport?: () => Promise<StatsReport | undefined>;
  restartTrack?: (options?: LkAudioCapture) => Promise<void>;
  getDeviceId?: () => Promise<string | undefined>;
  constructor(
    readonly kind: string,
    readonly sid?: string,
  ) {}

  attach(element?: HTMLMediaElement): HTMLMediaElement {
    const target = element ?? document.createElement('audio');
    this.attached.push(target);
    return target;
  }

  detach(element?: HTMLMediaElement): HTMLMediaElement | HTMLMediaElement[] {
    if (element) {
      this.attached.splice(this.attached.indexOf(element), 1);
      return element;
    }
    return this.attached.splice(0);
  }
}

class FakeParticipant implements LkParticipant {
  isSpeaking = false;
  isMicrophoneEnabled = true;
  connectionQuality = 'excellent';
  readonly publications = new Map<string, LkPublication>();

  constructor(
    readonly identity: string,
    readonly name?: string,
  ) {}

  getTrackPublication(source: string): LkPublication | undefined {
    return this.publications.get(source);
  }
}

class FakeLocal extends FakeParticipant implements LkLocalParticipant {
  readonly calls: string[] = [];
  readonly captures: (LkAudioCapture | undefined)[] = [];

  setMicrophoneEnabled(enabled: boolean, options?: LkAudioCapture): Promise<unknown> {
    this.calls.push(`mic ${String(enabled)}`);
    this.captures.push(options);
    this.isMicrophoneEnabled = enabled;
    return Promise.resolve();
  }

  setCameraEnabled(enabled: boolean): Promise<unknown> {
    this.calls.push(`camera ${String(enabled)}`);
    return Promise.resolve();
  }

  setScreenShareEnabled(enabled: boolean, options?: { audio: boolean }): Promise<unknown> {
    this.calls.push(`screen ${String(enabled)} ${String(options?.audio)}`);
    return Promise.resolve();
  }
}

class FakeRoom implements LkRoom {
  static last: FakeRoom | undefined;
  readonly localParticipant = new FakeLocal('t-1', 'Ольга');
  readonly remoteParticipants = new Map<string, LkParticipant>();
  canPlaybackAudio = true;
  serverInfo?: { version?: string };
  readonly listeners = new Map<string, ((...args: never[]) => void)[]>();
  readonly calls: string[] = [];
  failConnect = false;

  constructor(readonly options: LkRoomOptions) {
    FakeRoom.last = this;
  }

  on(event: string, listener: (...args: never[]) => void): unknown {
    this.listeners.set(event, [...(this.listeners.get(event) ?? []), listener]);
    return this;
  }

  fire(event: string, ...args: unknown[]): void {
    for (const listener of this.listeners.get(event) ?? []) {
      Reflect.apply(listener, undefined, args);
    }
  }

  connect(url: string, token: string): Promise<void> {
    this.calls.push(`connect ${url} ${token}`);
    return FakeRoom.nextFails ? Promise.reject(new Error('could not connect')) : Promise.resolve();
  }

  static nextFails = false;

  disconnect(): Promise<void> {
    this.calls.push('disconnect');
    this.fire('disconnected', 1);
    return Promise.resolve();
  }

  switchActiveDevice(kind: MediaDeviceKind, deviceId: string): Promise<unknown> {
    this.calls.push(`switch ${kind} ${deviceId}`);
    return Promise.resolve(true);
  }

  startAudio(): Promise<void> {
    this.calls.push('startAudio');
    this.canPlaybackAudio = true;
    return Promise.resolve();
  }
}

const MEDIA: CallMedia = { microphone: true, camera: true, microphoneId: 'mic-2', cameraId: null };
const LK: LiveKitModule = { Room: FakeRoom };

describe('LiveKit engine', () => {
  let snapshots: CallSnapshot[];

  function last(): CallSnapshot {
    const snapshot = snapshots.at(-1);
    if (snapshot === undefined) {
      throw new Error('no snapshot');
    }
    return snapshot;
  }

  function room(): FakeRoom {
    if (FakeRoom.last === undefined) {
      throw new Error('no room');
    }
    return FakeRoom.last;
  }

  beforeEach(() => {
    snapshots = [];
    FakeRoom.nextFails = false;
  });

  afterEach(() => {
    document.querySelectorAll('.tb-call-audio').forEach((element) => {
      element.remove();
    });
  });

  async function connect() {
    return createLiveKitEngine(LK, document).connect('wss://p/livekit', 'jwt', MEDIA, (snapshot) =>
      snapshots.push(snapshot),
    );
  }

  it('connects with the chosen devices and adaptive video', async () => {
    await connect();

    expect(room().calls).toEqual(['connect wss://p/livekit jwt']);
    expect(room().options.audioCaptureDefaults.deviceId).toBe('mic-2');
    expect(room().options.audioCaptureDefaults.voiceIsolation).toBe(false);
    expect(room().options.videoCaptureDefaults.deviceId).toBeUndefined();
    expect(room().options.adaptiveStream).toBe(true);
    expect(last()).toEqual({
      state: 'connected',
      participants: [
        {
          id: 't-1',
          name: 'Ольга',
          local: true,
          speaking: false,
          microphone: true,
          camera: null,
          screen: null,
          quality: 'excellent',
        },
      ],
      audioBlocked: false,
      endReason: null,
    });
  });

  it('shows the others with their camera and screen and keeps one ref per track', async () => {
    await connect();
    const anna = new FakeParticipant('s-1', 'Анна');
    const camera = new FakeTrack('video', 'TR_cam');
    anna.publications.set('camera', { isMuted: false, track: camera });
    anna.publications.set('screen_share', { isMuted: true, track: new FakeTrack('video') });
    anna.connectionQuality = 'weird';
    anna.isSpeaking = true;
    room().remoteParticipants.set('s-1', anna);
    room().remoteParticipants.set('s-2', new FakeParticipant('s-2', ' '));

    room().fire('participantConnected');
    const shown = last().participants[1];
    room().fire('activeSpeakersChanged');

    expect(shown).toMatchObject({ id: 's-1', name: 'Анна', speaking: true, quality: 'unknown' });
    expect(shown?.screen).toBeNull();
    expect(shown?.camera?.id).toBe('TR_cam');
    expect(last().participants[1]?.camera).toBe(shown?.camera);
    expect(last().participants[2]?.name).toBe('Участник');
    const video = document.createElement('video');
    shown?.camera?.attach(video);
    expect(camera.attached).toEqual([video]);
    shown?.camera?.detach(video);
    expect(camera.attached).toEqual([]);

    const unnamed = new FakeParticipant('s-3');
    unnamed.publications.set('camera', { isMuted: false, track: new FakeTrack('video') });
    room().remoteParticipants.set('s-3', unnamed);
    room().fire('trackSubscribed', new FakeTrack('video'));
    expect(last().participants[3]?.camera?.id).toMatch(/^track-/);
  });

  it('plays the sound of the others in hidden elements', async () => {
    await connect();
    const voice = new FakeTrack('audio');

    room().fire('trackSubscribed', voice);
    expect(document.querySelectorAll('.tb-call-audio audio')).toHaveLength(1);
    room().fire('trackUnsubscribed', new FakeTrack('video'));
    room().fire('trackUnsubscribed', voice);
    expect(document.querySelectorAll('.tb-call-audio audio')).toHaveLength(0);

    const single = new FakeTrack('audio');
    single.detach = () => document.createElement('audio');
    room().fire('trackSubscribed', single);
    room().fire('trackUnsubscribed', single);
  });

  it('turns devices on and off and unblocks the sound', async () => {
    const call = await connect();
    room().canPlaybackAudio = false;
    room().fire('audioPlaybackChanged');
    expect(last().audioBlocked).toBe(true);

    await call.setMicrophone(false);
    await call.setCamera(true);
    await call.setScreenShare(true);
    await call.switchDevice('videoinput', 'cam-2');
    await call.startAudio();

    expect(room().localParticipant.calls).toEqual(['mic false', 'camera true', 'screen true true']);
    expect(room().calls).toContain('switch videoinput cam-2');
    expect(last().audioBlocked).toBe(false);
    expect(last().participants[0]?.microphone).toBe(false);
  });

  it('follows reconnection and the end of the call', async () => {
    const call = await connect();
    room().fire('reconnecting');
    expect(last().state).toBe('reconnecting');
    room().fire('reconnected');
    expect(last().state).toBe('connected');
    expect(document.querySelector('.tb-call-audio')).not.toBeNull();

    room().fire('disconnected', 4);
    expect(last()).toMatchObject({ state: 'disconnected', endReason: 'removed' });
    expect(document.querySelector('.tb-call-audio')).toBeNull();

    await call.leave();
    expect(room().calls).toContain('disconnect');
    expect(last().endReason).toBeNull();
  });

  it('cleans up when the server is out of reach', async () => {
    FakeRoom.nextFails = true;

    await expect(connect()).rejects.toThrow('could not connect');
    expect(document.querySelector('.tb-call-audio')).toBeNull();
  });

  it('names the reasons of an ended call', () => {
    expect(endReason(1)).toBeNull();
    expect(endReason(2)).toBe('replaced');
    expect(endReason(4)).toBe('removed');
    expect(endReason(5)).toBe('removed');
    expect(endReason(9)).toBe('lost');
    expect(endReason(undefined)).toBe('lost');
  });

  it('restarts the microphone with new processing and reads the statistics', async () => {
    const call = await connect();
    const quiet = { echoCancellation: false, noiseSuppression: true, autoGainControl: false };
    await call.setAudioProcessing(quiet);
    await call.setMicrophone(true);
    await call.setMicrophone(false);
    expect(room().localParticipant.captures.slice(-2)).toEqual([
      { ...quiet, voiceIsolation: false },
      undefined,
    ]);

    const restarts: (LkAudioCapture | undefined)[] = [];
    const mic = new FakeTrack('audio', 'TR_mic');
    mic.restartTrack = (options) => {
      restarts.push(options);
      return Promise.resolve();
    };
    mic.getDeviceId = () => Promise.resolve('mic-2');
    mic.getRTCStatsReport = () =>
      Promise.resolve(
        new Map<string, unknown>([
          ['T', { id: 'T', type: 'transport', selectedCandidatePairId: 'P' }],
          ['P', { id: 'P', type: 'candidate-pair', currentRoundTripTime: 0.05 }],
        ]),
      );
    room().localParticipant.publications.set('microphone', { isMuted: false, track: mic });
    const anna = new FakeParticipant('s-1', 'Анна');
    const voice = new FakeTrack('audio');
    voice.getRTCStatsReport = () => Promise.reject(new Error('closed'));
    anna.publications.set('microphone', { isMuted: false, track: voice });
    anna.publications.set('camera', { isMuted: false, track: new FakeTrack('video') });
    room().remoteParticipants.set('s-1', anna);
    room().serverInfo = { version: '1.13.7' };

    await call.setAudioProcessing(DEFAULT_AUDIO_PROCESSING);
    mic.getDeviceId = () => Promise.resolve(undefined);
    await call.setAudioProcessing(quiet);
    expect(restarts).toEqual([
      { ...DEFAULT_AUDIO_PROCESSING, voiceIsolation: false, deviceId: 'mic-2' },
      { ...quiet, voiceIsolation: false },
    ]);

    const stats = await call.stats();
    expect(stats.serverVersion).toBe('1.13.7');
    expect(stats.transport?.roundTrip).toBe(50);
    room().serverInfo = undefined;
    expect((await call.stats()).serverVersion).toBeNull();
  });
});
