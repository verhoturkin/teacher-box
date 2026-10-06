import {
  DOCUMENT,
  DestroyRef,
  Injectable,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '@core/auth/auth.service';
import { describeError } from '@core/http/error-messages';
import { Snackbar } from '@core/snackbar/snackbar';
import { MeetingsApi } from '../data-access/meetings-api';
import { CallDevices, mediaErrorText } from './call-devices';
import {
  AudioProcessing,
  CALL_ENGINE,
  CallConnection,
  CallDeviceKind,
  CallEndReason,
  CallMedia,
  CallParticipant,
  CallSnapshot,
  CallStats,
} from './call-engine';

/**
 * Where the call is: `connecting` → `connected` (⇄ `reconnecting`) → `idle` when the user leaves, or
 * `ended` when it ended by itself or could not start (the window says why).
 */
export type CallPhase = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'ended';

/** The full window or the floating mini window over the portal. */
export type CallMode = 'expanded' | 'minimized';

/** The room the user is about to join: the pre-join sheet. */
export interface CallTarget {
  readonly ownerId: string;
  readonly title: string;
}

/** The path of the portal that opens a built-in call (`RoomService.CALL_PATH`). */
export const CALL_PATH = '/call/';

const LIVE: ReadonlySet<CallPhase> = new Set(['connecting', 'connected', 'reconnecting']);

/** What the window says when a call ended by itself. */
export const END_TEXTS: Readonly<Record<CallEndReason | 'failed', string>> = {
  removed: 'Звонок завершён: доступ к комнате закрыт.',
  replaced: 'Вы вошли в этот звонок на другой вкладке или устройстве.',
  lost: 'Связь со звонком потеряна.',
  failed: 'Не удалось подключиться к звонку. Проверьте интернет и попробуйте ещё раз.',
};

/**
 * The one built-in call of this tab (ADR-0030): kept above the routes, so it goes on while the user
 * works in the portal. The media library is loaded with the first call.
 */
@Injectable({ providedIn: 'root' })
export class CallSession {
  private readonly api = inject(MeetingsApi);
  private readonly devices = inject(CallDevices);
  private readonly loadEngine = inject(CALL_ENGINE);
  private readonly snackbar = inject(Snackbar);
  private readonly document = inject(DOCUMENT);
  private connection: CallConnection | null = null;
  /** Bumped by every join and leave: answers of an older attempt are ignored. */
  private attempt = 0;

  readonly phase = signal<CallPhase>('idle');
  readonly mode = signal<CallMode>('expanded');
  /** The room being opened: the token is requested. */
  readonly opening = signal<string | null>(null);
  readonly prejoin = signal<CallTarget | null>(null);
  readonly target = signal<CallTarget | null>(null);
  readonly participants = signal<readonly CallParticipant[]>([]);
  readonly audioBlocked = signal(false);
  /** Why the call ended (`ended`). */
  readonly endText = signal<string | null>(null);
  /** Set when the call connected: the window counts the time. */
  readonly startedAt = signal<number | null>(null);
  /** The last change of people, for screen readers. */
  readonly announcement = signal('');
  readonly media = signal<CallMedia>(this.devices.preferences());
  readonly audioProcessing = signal<AudioProcessing>(this.devices.audioProcessing());

  readonly live = computed(() => LIVE.has(this.phase()));
  readonly local = computed(() => this.participants().find((person) => person.local) ?? null);
  readonly others = computed(() => this.participants().filter((person) => !person.local));
  readonly microphone = computed(() => this.local()?.microphone ?? false);
  readonly camera = computed(() => (this.local()?.camera ?? null) !== null);
  readonly screen = computed(() => (this.local()?.screen ?? null) !== null);

  constructor() {
    const auth = inject(AuthService);
    let signedIn = auth.isAuthenticated();
    effect(() => {
      const now = auth.isAuthenticated();
      if (signedIn && !now) {
        untracked(() => {
          this.prejoin.set(null);
          if (this.live()) {
            void this.leave();
          }
        });
      }
      signedIn = now;
    });
    const window = this.document.defaultView;
    const unload = (event: BeforeUnloadEvent): void => {
      if (this.live()) {
        event.preventDefault();
      }
    };
    window?.addEventListener('beforeunload', unload);
    inject(DestroyRef).onDestroy(() => {
      window?.removeEventListener('beforeunload', unload);
    });
  }

  /** Opens the room: the pre-join sheet, or the window if this call is going on. */
  open(ownerId: string): void {
    if (this.live() && this.target()?.ownerId === ownerId) {
      this.mode.set('expanded');
      return;
    }
    if (this.opening() !== null) {
      return;
    }
    this.opening.set(ownerId);
    this.api.callToken(ownerId).subscribe({
      next: (join) => {
        this.opening.set(null);
        this.prejoin.set({ ownerId, title: join.title });
      },
      error: (error: unknown) => {
        this.opening.set(null);
        this.snackbar.error(describeError(error, 'Не удалось открыть звонок'));
      },
    });
  }

  cancelPrejoin(): void {
    this.prejoin.set(null);
  }

  /** Joins the room of the pre-join sheet with the chosen devices; leaves the current call first. */
  async join(media: CallMedia): Promise<void> {
    const target = this.prejoin();
    if (target === null) {
      return;
    }
    this.prejoin.set(null);
    if (this.live()) {
      await this.leave();
    }
    this.devices.remember(media);
    this.media.set(media);
    const attempt = ++this.attempt;
    this.target.set(target);
    this.mode.set('expanded');
    this.participants.set([]);
    this.endText.set(null);
    this.startedAt.set(null);
    this.phase.set('connecting');
    try {
      const join = await firstValueFrom(this.api.callToken(target.ownerId));
      const engine = await this.loadEngine();
      const connection = await engine.connect(this.serverUrl(), join.token, media, (snapshot) => {
        if (attempt === this.attempt) {
          this.apply(snapshot);
        }
      });
      if (attempt !== this.attempt) {
        await connection.leave();
        return;
      }
      this.connection = connection;
      this.startedAt.set(Date.now());
      // only remembered by the engine: the microphone is not on yet
      await connection.setAudioProcessing(this.audioProcessing()).catch(() => undefined);
      await this.turnOn(media);
    } catch (error: unknown) {
      if (attempt === this.attempt) {
        this.end(describeError(error, END_TEXTS.failed));
      }
    }
  }

  async leave(): Promise<void> {
    this.attempt += 1;
    const connection = this.connection;
    this.connection = null;
    this.reset();
    if (connection !== null) {
      await connection.leave().catch(() => undefined);
    }
  }

  /** Closes the window of an ended call. */
  close(): void {
    this.reset();
  }

  /** Joins the room of an ended call again. */
  retry(): void {
    const target = this.target();
    this.reset();
    if (target !== null) {
      this.open(target.ownerId);
    }
  }

  expand(): void {
    this.mode.set('expanded');
  }

  minimize(): void {
    this.mode.set('minimized');
  }

  async toggleMicrophone(): Promise<void> {
    await this.run((connection) => connection.setMicrophone(!this.microphone()), mediaErrorText);
  }

  async toggleCamera(): Promise<void> {
    await this.run((connection) => connection.setCamera(!this.camera()), mediaErrorText);
  }

  async toggleScreen(): Promise<void> {
    const sharing = this.screen();
    await this.run(
      (connection) => connection.setScreenShare(!sharing),
      () => 'Не удалось показать экран',
      true,
    );
  }

  async switchDevice(kind: CallDeviceKind, deviceId: string): Promise<void> {
    const media =
      kind === 'audioinput'
        ? { ...this.media(), microphoneId: deviceId }
        : { ...this.media(), cameraId: deviceId };
    this.media.set(media);
    this.devices.remember(media);
    await this.run(
      (connection) => connection.switchDevice(kind, deviceId),
      () => 'Не удалось переключить устройство',
    );
  }

  /** Restarts the microphone with the new processing; remembered on the device. */
  async setAudioProcessing(processing: AudioProcessing): Promise<void> {
    this.audioProcessing.set(processing);
    this.devices.rememberAudioProcessing(processing);
    await this.run(
      (connection) => connection.setAudioProcessing(processing),
      () => 'Не удалось изменить обработку звука',
    );
  }

  /** «Сведения о связи»; `null` outside a call or when the browser gives none. */
  async stats(): Promise<CallStats | null> {
    const connection = this.connection;
    if (connection === null) {
      return null;
    }
    try {
      return await connection.stats();
    } catch {
      return null;
    }
  }

  async startAudio(): Promise<void> {
    await this.run(
      (connection) => connection.startAudio(),
      () => 'Не удалось включить звук',
    );
  }

  private async turnOn(media: CallMedia): Promise<void> {
    const connection = this.connection;
    if (connection === null) {
      return;
    }
    for (const [on, enable] of [
      [media.microphone, () => connection.setMicrophone(true)],
      [media.camera, () => connection.setCamera(true)],
    ] as const) {
      if (on) {
        try {
          await enable();
        } catch (error: unknown) {
          this.snackbar.error(mediaErrorText(error));
        }
      }
    }
  }

  /** @param quietCancel the user closed the browser's screen picker: not an error */
  private async run(
    action: (connection: CallConnection) => Promise<void>,
    failure: (error: unknown) => string,
    quietCancel = false,
  ): Promise<void> {
    const connection = this.connection;
    if (connection === null) {
      return;
    }
    try {
      await action(connection);
    } catch (error: unknown) {
      const cancelled = error instanceof Error && error.name === 'NotAllowedError';
      if (!(quietCancel && cancelled)) {
        this.snackbar.error(failure(error));
      }
    }
  }

  private apply(snapshot: CallSnapshot): void {
    this.announce(this.participants(), snapshot.participants);
    this.participants.set(snapshot.participants);
    this.audioBlocked.set(snapshot.audioBlocked);
    if (snapshot.state === 'disconnected') {
      this.connection = null;
      if (snapshot.endReason !== null) {
        this.end(END_TEXTS[snapshot.endReason]);
      }
      return;
    }
    this.phase.set(snapshot.state);
  }

  private announce(before: readonly CallParticipant[], after: readonly CallParticipant[]): void {
    if (before.length === 0) {
      return;
    }
    const known = new Set(before.map((person) => person.id));
    const present = new Set(after.map((person) => person.id));
    const came = after.filter((person) => !known.has(person.id)).map((person) => person.name);
    const left = before.filter((person) => !present.has(person.id)).map((person) => person.name);
    const parts = [
      ...came.map((name) => `${name} в звонке`),
      ...left.map((name) => `${name} вышел из звонка`),
    ];
    if (parts.length > 0) {
      this.announcement.set(parts.join('. '));
    }
  }

  private end(text: string): void {
    this.connection = null;
    this.phase.set('ended');
    this.mode.set('expanded');
    this.endText.set(text);
    this.startedAt.set(null);
  }

  private reset(): void {
    this.phase.set('idle');
    this.target.set(null);
    this.participants.set([]);
    this.audioBlocked.set(false);
    this.endText.set(null);
    this.startedAt.set(null);
    this.announcement.set('');
  }

  /** Signalling goes through the portal itself (`/livekit`, ADR-0030). */
  private serverUrl(): string {
    return `${this.document.location.origin}/livekit`;
  }
}
