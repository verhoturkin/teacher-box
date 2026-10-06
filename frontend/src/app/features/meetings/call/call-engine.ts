import { InjectionToken } from '@angular/core';

/** How well a participant is connected (LiveKit's connection quality). */
export type CallQuality = 'excellent' | 'good' | 'poor' | 'lost' | 'unknown';

/** A video track a tile shows: attached to a `<video>` and detached when the tile goes. */
export interface MediaRef {
  /** Stable while the track lives: a tile re-attaches only when it changes. */
  readonly id: string;
  attach(element: HTMLMediaElement): void;
  detach(element: HTMLMediaElement): void;
}

/** One user in the call as the window shows them. */
export interface CallParticipant {
  /** The user id (LiveKit identity). */
  readonly id: string;
  readonly name: string;
  readonly local: boolean;
  readonly speaking: boolean;
  readonly microphone: boolean;
  /** The camera while it is on. */
  readonly camera: MediaRef | null;
  /** The shared screen while it is shared. */
  readonly screen: MediaRef | null;
  readonly quality: CallQuality;
}

/** Why the call ended without the user leaving it. */
export type CallEndReason = 'removed' | 'replaced' | 'lost';

/** The state of the connection after every change in the room. */
export interface CallSnapshot {
  readonly state: 'connected' | 'reconnecting' | 'disconnected';
  /** The local participant first, then the others in the order they came. */
  readonly participants: readonly CallParticipant[];
  /** The browser blocked sound until the user acts («Включить звук»). */
  readonly audioBlocked: boolean;
  /** Set once the call ended by itself. */
  readonly endReason: CallEndReason | null;
}

/** What the user chose before joining. */
export interface CallMedia {
  readonly microphone: boolean;
  readonly camera: boolean;
  readonly microphoneId: string | null;
  readonly cameraId: string | null;
}

export type CallDeviceKind = 'audioinput' | 'videoinput';

/** A joined call. */
export interface CallConnection {
  setMicrophone(enabled: boolean): Promise<void>;
  setCamera(enabled: boolean): Promise<void>;
  setScreenShare(enabled: boolean): Promise<void>;
  switchDevice(kind: CallDeviceKind, deviceId: string): Promise<void>;
  /** Unblocks the sound after a click. */
  startAudio(): Promise<void>;
  leave(): Promise<void>;
}

/** The media library behind the calls (LiveKit), loaded only when a call starts (ADR-0030). */
export interface CallEngine {
  /**
   * @param url      the signalling address (`<portal>/livekit`)
   * @param onUpdate called on every change in the room
   * @throws when the server cannot be reached or the browser refuses the camera or the microphone
   */
  connect(
    url: string,
    token: string,
    media: CallMedia,
    onUpdate: (snapshot: CallSnapshot) => void,
  ): Promise<CallConnection>;
}

/**
 * The engine's code: one dynamic `import()` of `livekit-engine.ts`, the only file importing
 * `livekit-client`, so it lands in a lazy chunk. A token so tests replace it.
 */
export const CALL_ENGINE = new InjectionToken<() => Promise<CallEngine>>('CALL_ENGINE', {
  providedIn: 'root',
  factory: () => () => import('./livekit-engine').then((engine) => engine.loadLiveKitEngine()),
});
