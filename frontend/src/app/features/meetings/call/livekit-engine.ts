import type {
  CallConnection,
  CallDeviceKind,
  CallEndReason,
  CallEngine,
  CallMedia,
  CallParticipant,
  CallQuality,
  CallSnapshot,
  MediaRef,
} from './call-engine';

/*
 * The parts of `livekit-client` the calls use — a narrow contract so tests pass a fake room. Values are
 * LiveKit's own: event names (`RoomEvent`), track sources (`Track.Source`), disconnect reasons.
 */

/** A track of LiveKit (`Track`): attached to media elements. */
export interface LkTrack {
  readonly sid?: string;
  readonly kind: string;
  attach(element?: HTMLMediaElement): HTMLMediaElement;
  detach(element?: HTMLMediaElement): HTMLMediaElement | HTMLMediaElement[];
}

/** A published track (`TrackPublication`). */
export interface LkPublication {
  readonly isMuted: boolean;
  readonly track?: LkTrack;
}

/** A user in the room (`Participant`). */
export interface LkParticipant {
  readonly identity: string;
  readonly name?: string;
  readonly isSpeaking: boolean;
  readonly isMicrophoneEnabled: boolean;
  readonly connectionQuality: string;
  getTrackPublication(source: string): LkPublication | undefined;
}

/** This user (`LocalParticipant`). */
export interface LkLocalParticipant extends LkParticipant {
  setMicrophoneEnabled(enabled: boolean): Promise<unknown>;
  setCameraEnabled(enabled: boolean): Promise<unknown>;
  setScreenShareEnabled(enabled: boolean, options?: { audio: boolean }): Promise<unknown>;
}

/** Capture defaults and adaptive video (`RoomOptions`). */
export interface LkRoomOptions {
  readonly adaptiveStream: boolean;
  readonly dynacast: boolean;
  readonly audioCaptureDefaults: {
    readonly deviceId?: string;
    readonly echoCancellation: boolean;
    readonly noiseSuppression: boolean;
    readonly autoGainControl: boolean;
    readonly voiceIsolation: boolean;
  };
  readonly videoCaptureDefaults: {
    readonly deviceId?: string;
    readonly resolution: {
      readonly width: number;
      readonly height: number;
      readonly frameRate: number;
    };
  };
}

/** The room (`Room`). */
export interface LkRoom {
  readonly localParticipant: LkLocalParticipant;
  readonly remoteParticipants: ReadonlyMap<string, LkParticipant>;
  readonly canPlaybackAudio: boolean;
  on(event: string, listener: (...args: never[]) => void): unknown;
  connect(url: string, token: string): Promise<void>;
  disconnect(): Promise<void>;
  switchActiveDevice(kind: MediaDeviceKind, deviceId: string): Promise<unknown>;
  startAudio(): Promise<void>;
}

export interface LiveKitModule {
  readonly Room: new (options: LkRoomOptions) => LkRoom;
}

/** Events after which the window is redrawn. */
const CHANGES = [
  'participantConnected',
  'participantDisconnected',
  'trackPublished',
  'trackUnpublished',
  'trackSubscribed',
  'trackUnsubscribed',
  'trackMuted',
  'trackUnmuted',
  'localTrackPublished',
  'localTrackUnpublished',
  'activeSpeakersChanged',
  'connectionQualityChanged',
  'participantNameChanged',
  'audioPlaybackChanged',
];

/** `DisconnectReason` of LiveKit's protocol. */
const DUPLICATE_IDENTITY = 2;
const PARTICIPANT_REMOVED = 4;
const ROOM_DELETED = 5;
const CLIENT_INITIATED = 1;

const QUALITIES: readonly CallQuality[] = ['excellent', 'good', 'poor', 'lost'];

function quality(value: string): CallQuality {
  return QUALITIES.find((known) => known === value) ?? 'unknown';
}

/** Why LiveKit closed the room; `null` when the user left. */
export function endReason(reason: number | undefined): CallEndReason | null {
  switch (reason) {
    case CLIENT_INITIATED:
      return null;
    case DUPLICATE_IDENTITY:
      return 'replaced';
    case PARTICIPANT_REMOVED:
    case ROOM_DELETED:
      return 'removed';
    default:
      return 'lost';
  }
}

/** LiveKit through a narrow contract; `document` holds the hidden audio elements of the others. */
export function createLiveKitEngine(lk: LiveKitModule, document: Document): CallEngine {
  return {
    async connect(url, token, media, onUpdate) {
      const room = new lk.Room(roomOptions(media));
      const call = new LiveKitCall(room, document, onUpdate);
      try {
        await room.connect(url, token);
      } catch (error: unknown) {
        call.dispose();
        throw error;
      }
      call.emit();
      return call;
    },
  };
}

/** The real `livekit-client`, loaded with the call (a lazy chunk). */
export async function loadLiveKitEngine(): Promise<CallEngine> {
  const lk = await import('livekit-client');
  return createLiveKitEngine(lk, window.document);
}

function roomOptions(media: CallMedia): LkRoomOptions {
  return {
    adaptiveStream: true,
    dynacast: true,
    audioCaptureDefaults: {
      ...(media.microphoneId === null ? {} : { deviceId: media.microphoneId }),
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      // LiveKit asks for Chrome's voice isolation by default: on a slow computer it cuts and stutters
      // the voice (docs/modules/meetings.md); the usual noise suppression stays.
      voiceIsolation: false,
    },
    videoCaptureDefaults: {
      ...(media.cameraId === null ? {} : { deviceId: media.cameraId }),
      resolution: { width: 1280, height: 720, frameRate: 30 },
    },
  };
}

class LiveKitCall implements CallConnection {
  private readonly audio: HTMLElement;
  private readonly refs = new WeakMap<LkTrack, MediaRef>();
  private state: CallSnapshot['state'] = 'connected';
  private ended: CallEndReason | null = null;
  private nextRef = 0;

  constructor(
    private readonly room: LkRoom,
    document: Document,
    private readonly onUpdate: (snapshot: CallSnapshot) => void,
  ) {
    this.audio = document.createElement('div');
    this.audio.hidden = true;
    this.audio.className = 'tb-call-audio';
    document.body.append(this.audio);
    for (const event of CHANGES) {
      room.on(event, () => {
        this.emit();
      });
    }
    room.on('trackSubscribed', (track: LkTrack) => {
      if (track.kind === 'audio') {
        this.audio.append(track.attach());
      }
    });
    room.on('trackUnsubscribed', (track: LkTrack) => {
      if (track.kind === 'audio') {
        removeElements(track.detach());
      }
    });
    room.on('reconnecting', () => {
      this.state = 'reconnecting';
      this.emit();
    });
    room.on('reconnected', () => {
      this.state = 'connected';
      this.emit();
    });
    room.on('disconnected', (reason?: number) => {
      this.state = 'disconnected';
      this.ended = endReason(reason);
      this.dispose();
      this.emit();
    });
  }

  emit(): void {
    const local = this.room.localParticipant;
    this.onUpdate({
      state: this.state,
      participants: [
        this.view(local, true),
        ...[...this.room.remoteParticipants.values()].map((participant) =>
          this.view(participant, false),
        ),
      ],
      audioBlocked: !this.room.canPlaybackAudio,
      endReason: this.ended,
    });
  }

  async setMicrophone(enabled: boolean): Promise<void> {
    await this.room.localParticipant.setMicrophoneEnabled(enabled);
    this.emit();
  }

  async setCamera(enabled: boolean): Promise<void> {
    await this.room.localParticipant.setCameraEnabled(enabled);
    this.emit();
  }

  async setScreenShare(enabled: boolean): Promise<void> {
    await this.room.localParticipant.setScreenShareEnabled(enabled, { audio: true });
    this.emit();
  }

  async switchDevice(kind: CallDeviceKind, deviceId: string): Promise<void> {
    await this.room.switchActiveDevice(kind, deviceId);
  }

  async startAudio(): Promise<void> {
    await this.room.startAudio();
    this.emit();
  }

  async leave(): Promise<void> {
    await this.room.disconnect();
    this.dispose();
  }

  dispose(): void {
    this.audio.remove();
  }

  private view(participant: LkParticipant, local: boolean): CallParticipant {
    return {
      id: participant.identity,
      name: participant.name?.trim() ? participant.name : 'Участник',
      local,
      speaking: participant.isSpeaking,
      microphone: participant.isMicrophoneEnabled,
      camera: this.ref(participant.getTrackPublication('camera')),
      screen: this.ref(participant.getTrackPublication('screen_share')),
      quality: quality(participant.connectionQuality),
    };
  }

  /** One `MediaRef` per track, so a tile keeps its video element while the track lives. */
  private ref(publication: LkPublication | undefined): MediaRef | null {
    const track = publication?.track;
    if (publication === undefined || publication.isMuted || track === undefined) {
      return null;
    }
    let ref = this.refs.get(track);
    if (ref === undefined) {
      this.nextRef += 1;
      ref = {
        id: track.sid ?? `track-${String(this.nextRef)}`,
        attach: (element) => {
          track.attach(element);
        },
        detach: (element) => {
          track.detach(element);
        },
      };
      this.refs.set(track, ref);
    }
    return ref;
  }
}

function removeElements(elements: HTMLMediaElement | HTMLMediaElement[]): void {
  for (const element of Array.isArray(elements) ? elements : [elements]) {
    element.remove();
  }
}
