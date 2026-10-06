import { DOCUMENT, Injectable, inject } from '@angular/core';
import { CallMedia } from './call-engine';

/** Microphones and cameras of this device. */
export interface DeviceList {
  readonly microphones: readonly MediaDeviceInfo[];
  readonly cameras: readonly MediaDeviceInfo[];
}

const PREFERENCES_KEY = 'tb-call-media';

const DEFAULT_MEDIA: CallMedia = {
  microphone: true,
  camera: true,
  microphoneId: null,
  cameraId: null,
};

/** Why the browser gave no camera or microphone, in the words of the window. */
export function mediaErrorText(error: unknown): string {
  const name = error instanceof DOMException || error instanceof Error ? error.name : '';
  switch (name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'Браузер не дал доступ к камере и микрофону. Разрешите его в настройках сайта.';
    case 'NotFoundError':
    case 'OverconstrainedError':
      return 'Камера или микрофон не найдены.';
    case 'NotReadableError':
      return 'Камера или микрофон заняты другой программой.';
    default:
      return 'Не удалось включить камеру или микрофон.';
  }
}

/**
 * The browser's media devices for the calls: the preview before joining, the list of devices and the
 * choice remembered on this device (not on the server).
 */
@Injectable({ providedIn: 'root' })
export class CallDevices {
  private readonly window = inject(DOCUMENT).defaultView;

  /** The browser can capture media (a secure page in a modern browser). */
  supported(): boolean {
    return this.devices() !== null;
  }

  /** Screen sharing exists in desktop browsers, not on phones. */
  canShareScreen(): boolean {
    const devices = this.devices();
    return devices !== null && typeof devices.getDisplayMedia === 'function';
  }

  /** A preview of the chosen camera and microphone; `null` when both are off. */
  async preview(media: CallMedia): Promise<MediaStream | null> {
    const devices = this.devices();
    if (devices === null || (!media.camera && !media.microphone)) {
      return null;
    }
    return devices.getUserMedia({
      audio: media.microphone ? constraint(media.microphoneId) : false,
      video: media.camera ? constraint(media.cameraId) : false,
    });
  }

  /** Names are known once the user allowed the camera or the microphone. */
  async list(): Promise<DeviceList> {
    const devices = this.devices();
    if (devices === null) {
      return { microphones: [], cameras: [] };
    }
    const all = await devices.enumerateDevices();
    return {
      microphones: all.filter((device) => device.kind === 'audioinput' && device.deviceId !== ''),
      cameras: all.filter((device) => device.kind === 'videoinput' && device.deviceId !== ''),
    };
  }

  /** The last choice on this device. */
  preferences(): CallMedia {
    try {
      const stored = this.window?.localStorage.getItem(PREFERENCES_KEY);
      if (stored) {
        const value: unknown = JSON.parse(stored);
        if (isMedia(value)) {
          return value;
        }
      }
    } catch {
      // storage is off (private mode): the defaults
    }
    return DEFAULT_MEDIA;
  }

  remember(media: CallMedia): void {
    try {
      this.window?.localStorage.setItem(PREFERENCES_KEY, JSON.stringify(media));
    } catch {
      // storage is off: the choice lives until the page closes
    }
  }

  private devices(): MediaDevices | null {
    return this.window?.navigator.mediaDevices ?? null;
  }
}

function constraint(deviceId: string | null): MediaTrackConstraints | boolean {
  return deviceId === null ? true : { deviceId: { exact: deviceId } };
}

function isMedia(value: unknown): value is CallMedia {
  return (
    typeof value === 'object' &&
    value !== null &&
    'microphone' in value &&
    typeof value.microphone === 'boolean' &&
    'camera' in value &&
    typeof value.camera === 'boolean' &&
    'microphoneId' in value &&
    (value.microphoneId === null || typeof value.microphoneId === 'string') &&
    'cameraId' in value &&
    (value.cameraId === null || typeof value.cameraId === 'string')
  );
}
