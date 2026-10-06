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

/** The browser's processing of the microphone, chosen in the devices menu (remembered on the device). */
export interface AudioProcessing {
  readonly echoCancellation: boolean;
  readonly noiseSuppression: boolean;
  readonly autoGainControl: boolean;
}

export const DEFAULT_AUDIO_PROCESSING: AudioProcessing = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
};

/** How this browser reaches the media server: the selected ICE candidate pair. */
export interface CallTransport {
  /** `udp` or `tcp` towards the server (or the TURN relay). */
  readonly protocol: string | null;
  /** `host` (direct), `srflx` / `prflx` (through NAT), `relay` (through TURN). */
  readonly candidate: string | null;
  /** The protocol between the browser and the TURN relay. */
  readonly relayProtocol: string | null;
  readonly localPort: number | null;
  readonly remoteAddress: string | null;
  readonly remotePort: number | null;
  /** Round trip, ms. */
  readonly roundTrip: number | null;
  /** The bandwidth estimate for sending, kbit/s. */
  readonly outgoingBitrate: number | null;
}

/** Received sound since joining, over all speakers. */
export interface CallAudioIn {
  readonly packetsReceived: number;
  readonly packetsLost: number;
  /** ms */
  readonly jitter: number | null;
  /** The share of sound the browser had to make up for lost or late packets, %. */
  readonly concealed: number | null;
}

/** A video stream: the largest one sent or received. */
export interface CallVideo {
  readonly width: number;
  readonly height: number;
  readonly frameRate: number | null;
}

/** Technical details of the connection («Сведения о связи»). */
export interface CallStats {
  readonly serverVersion: string | null;
  readonly transport: CallTransport | null;
  readonly audioIn: CallAudioIn | null;
  /** Lost sent sound as the server reports it, %. */
  readonly audioOutLoss: number | null;
  readonly videoOut: CallVideo | null;
  /** Why the browser lowers the sent video: `bandwidth`, `cpu`, `other`, `none`. */
  readonly videoOutLimit: string | null;
  readonly videoIn: CallVideo | null;
}

/** A joined call. */
export interface CallConnection {
  setMicrophone(enabled: boolean): Promise<void>;
  setCamera(enabled: boolean): Promise<void>;
  setScreenShare(enabled: boolean): Promise<void>;
  switchDevice(kind: CallDeviceKind, deviceId: string): Promise<void>;
  /** Used for the microphone from now on; a working microphone restarts with it. */
  setAudioProcessing(processing: AudioProcessing): Promise<void>;
  /** The current technical details. */
  stats(): Promise<CallStats>;
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
