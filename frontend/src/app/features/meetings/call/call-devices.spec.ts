import { TestBed } from '@angular/core/testing';
import { testProviders } from '@testing/setup';
import { CallDevices, mediaErrorText } from './call-devices';

function device(kind: MediaDeviceKind, deviceId: string): MediaDeviceInfo {
  return { kind, deviceId, label: deviceId, groupId: 'g', toJSON: () => ({}) };
}

describe('CallDevices', () => {
  let devices: CallDevices;
  let requests: MediaStreamConstraints[];

  function install(media: object | undefined): void {
    Object.defineProperty(navigator, 'mediaDevices', { value: media, configurable: true });
  }

  beforeEach(() => {
    requests = [];
    localStorage.removeItem('tb-call-media');
    TestBed.configureTestingModule({ providers: testProviders() });
    devices = TestBed.inject(CallDevices);
  });

  afterEach(() => {
    install(undefined);
  });

  it('previews the chosen devices and lists those with names', async () => {
    install({
      getUserMedia: (constraints?: MediaStreamConstraints) => {
        requests.push(constraints ?? {});
        return Promise.resolve({});
      },
      enumerateDevices: () =>
        Promise.resolve([
          device('audioinput', 'mic-1'),
          device('audioinput', ''),
          device('videoinput', 'cam-1'),
          device('audiooutput', 'out-1'),
        ]),
    });

    expect(devices.supported()).toBe(true);
    expect(devices.canShareScreen()).toBe(false);
    await devices.preview({
      microphone: true,
      camera: true,
      microphoneId: 'mic-1',
      cameraId: null,
    });
    expect(
      await devices.preview({
        microphone: false,
        camera: false,
        microphoneId: null,
        cameraId: null,
      }),
    ).toBeNull();
    await devices.preview({
      microphone: false,
      camera: true,
      microphoneId: null,
      cameraId: 'cam-1',
    });

    expect(requests).toEqual([
      { audio: { deviceId: { exact: 'mic-1' } }, video: true },
      { audio: false, video: { deviceId: { exact: 'cam-1' } } },
    ]);
    const list = await devices.list();
    expect(list.microphones.map((item) => item.deviceId)).toEqual(['mic-1']);
    expect(list.cameras.map((item) => item.deviceId)).toEqual(['cam-1']);
  });

  it('does without media devices', async () => {
    install(undefined);

    expect(devices.supported()).toBe(false);
    expect(devices.canShareScreen()).toBe(false);
    expect(
      await devices.preview({ microphone: true, camera: true, microphoneId: null, cameraId: null }),
    ).toBeNull();
    expect(await devices.list()).toEqual({ microphones: [], cameras: [] });
  });

  it('knows screen sharing', () => {
    install({ getDisplayMedia: () => Promise.reject(new Error('no')) });
    expect(devices.canShareScreen()).toBe(true);
  });

  it('remembers the choice on the device and ignores broken values', () => {
    expect(devices.preferences()).toEqual({
      microphone: true,
      camera: true,
      microphoneId: null,
      cameraId: null,
    });
    const chosen = { microphone: false, camera: true, microphoneId: 'mic-2', cameraId: null };
    devices.remember(chosen);
    expect(devices.preferences()).toEqual(chosen);

    for (const broken of [
      '{',
      '1',
      'null',
      '{"microphone":1}',
      '{"microphone":true,"camera":true}',
    ]) {
      localStorage.setItem('tb-call-media', broken);
      expect(devices.preferences().microphone).toBe(true);
    }
    localStorage.setItem(
      'tb-call-media',
      '{"microphone":true,"camera":true,"microphoneId":5,"cameraId":null}',
    );
    expect(devices.preferences().microphoneId).toBeNull();
    localStorage.setItem(
      'tb-call-media',
      '{"microphone":true,"camera":true,"microphoneId":null,"cameraId":7}',
    );
    expect(devices.preferences().cameraId).toBeNull();

    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('off');
    });
    expect(() => {
      devices.remember(chosen);
    }).not.toThrow();
    vi.restoreAllMocks();
  });

  it('remembers the sound processing, a missing or broken switch is on', () => {
    localStorage.removeItem('tb-call-audio');
    const all = { echoCancellation: true, noiseSuppression: true, autoGainControl: true };
    expect(devices.audioProcessing()).toEqual(all);
    const quiet = { ...all, noiseSuppression: false };
    devices.rememberAudioProcessing(quiet);
    expect(devices.audioProcessing()).toEqual(quiet);

    localStorage.setItem('tb-call-audio', '{"autoGainControl":false,"echoCancellation":"no"}');
    expect(devices.audioProcessing()).toEqual({ ...all, autoGainControl: false });
    for (const broken of ['{', '7']) {
      localStorage.setItem('tb-call-audio', broken);
      expect(devices.audioProcessing()).toEqual(all);
    }
    localStorage.removeItem('tb-call-audio');
  });

  it('names why the browser gave no media', () => {
    const named = (name: string) => Object.assign(new Error(name), { name });
    expect(mediaErrorText(named('NotAllowedError'))).toContain('не дал доступ');
    expect(mediaErrorText(named('SecurityError'))).toContain('не дал доступ');
    expect(mediaErrorText(named('NotFoundError'))).toBe('Камера или микрофон не найдены.');
    expect(mediaErrorText(named('OverconstrainedError'))).toBe('Камера или микрофон не найдены.');
    expect(mediaErrorText(named('NotReadableError'))).toContain('заняты');
    expect(mediaErrorText('x')).toBe('Не удалось включить камеру или микрофон.');
  });
});
