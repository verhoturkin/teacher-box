import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Button } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { Message } from 'primeng/message';
import { Select } from 'primeng/select';
import { Tooltip } from 'primeng/tooltip';
import { AuthService } from '@core/auth/auth.service';
import { ButtonAttributes } from '@shared/ui/button-attributes';
import { InitialsPipe } from '@shared/ui/initials';
import { CallDevices, DeviceList, mediaErrorText } from './call-devices';
import { CallMedia } from './call-engine';
import { CallSession, CallTarget } from './call-session';

interface DeviceOption {
  readonly label: string;
  readonly value: string;
}

/**
 * Before joining: the camera preview, microphone and camera toggles, the devices (remembered on this
 * device) and «Войти». Says when the current call will end.
 */
@Component({
  selector: 'tb-call-prejoin',
  imports: [FormsModule, Button, Dialog, Message, Select, Tooltip, ButtonAttributes, InitialsPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-dialog
      [header]="'Звонок: ' + target().title"
      [visible]="true"
      [modal]="true"
      [draggable]="false"
      [closeOnEscape]="true"
      [focusOnShow]="false"
      styleClass="tb-dialog tb-call-prejoin"
      (visibleChange)="cancel()"
    >
      <div class="tb-form">
        <div class="tb-call-prejoin__preview">
          @if (media().camera && stream()) {
            <video
              #preview
              class="tb-call-tile__video tb-call-tile__video--mirror"
              autoplay
              playsinline
              [muted]="true"
              aria-label="Изображение с камеры"
            ></video>
          } @else {
            <span class="tb-call-tile__avatar" aria-hidden="true">{{ name() | initials }}</span>
          }
        </div>
        <div class="tb-call-prejoin__toggles">
          <p-button
            [styleClass]="
              media().microphone ? 'tb-call-button' : 'tb-call-button tb-call-button--off'
            "
            icon="pi pi-microphone"
            [rounded]="true"
            [severity]="media().microphone ? 'secondary' : 'danger'"
            ariaLabel="Микрофон"
            [pTooltip]="media().microphone ? 'Войти с выключенным микрофоном' : 'Включить микрофон'"
            [tbAttributes]="{ 'aria-pressed': media().microphone ? 'true' : 'false' }"
            (onClick)="update({ microphone: !media().microphone })"
          />
          <p-button
            [styleClass]="media().camera ? 'tb-call-button' : 'tb-call-button tb-call-button--off'"
            icon="pi pi-video"
            [rounded]="true"
            [severity]="media().camera ? 'secondary' : 'danger'"
            ariaLabel="Камера"
            [pTooltip]="media().camera ? 'Войти с выключенной камерой' : 'Включить камеру'"
            [tbAttributes]="{ 'aria-pressed': media().camera ? 'true' : 'false' }"
            (onClick)="update({ camera: !media().camera })"
          />
        </div>
        @if (!supported) {
          <p-message severity="error" styleClass="tb-form-message">
            Этот браузер не умеет видеозвонки. Откройте портал в Chrome, Edge, Firefox или Safari.
          </p-message>
        } @else if (error(); as message) {
          <p-message severity="error" styleClass="tb-form-message">{{ message }}</p-message>
        }
        @if (microphones().length > 1) {
          <div class="tb-field">
            <label for="call-microphone">Микрофон</label>
            <p-select
              inputId="call-microphone"
              [options]="microphones()"
              optionLabel="label"
              optionValue="value"
              [ngModel]="media().microphoneId ?? microphones()[0]?.value"
              (ngModelChange)="update({ microphoneId: $event })"
              appendTo="body"
              [fluid]="true"
            />
          </div>
        }
        @if (cameras().length > 1) {
          <div class="tb-field">
            <label for="call-camera">Камера</label>
            <p-select
              inputId="call-camera"
              [options]="cameras()"
              optionLabel="label"
              optionValue="value"
              [ngModel]="media().cameraId ?? cameras()[0]?.value"
              (ngModelChange)="update({ cameraId: $event })"
              appendTo="body"
              [fluid]="true"
            />
          </div>
        }
        @if (switching(); as current) {
          <p class="tb-muted">Звонок «{{ current }}» завершится.</p>
        }
      </div>
      <ng-template #footer>
        <p-button label="Отмена" severity="secondary" [text]="true" (onClick)="cancel()" />
        <p-button label="Войти" icon="pi pi-video" [disabled]="!supported" (onClick)="join()" />
      </ng-template>
    </p-dialog>
  `,
})
export class CallPrejoin {
  private readonly session = inject(CallSession);
  private readonly devices = inject(CallDevices);

  readonly target = input.required<CallTarget>();
  /** The title of the call that joining will end. */
  readonly switching = input<string | null>(null);

  protected readonly supported = this.devices.supported();
  protected readonly media = signal<CallMedia>(this.session.media());
  protected readonly stream = signal<MediaStream | null>(null);
  protected readonly error = signal<string | null>(null);
  private readonly auth = inject(AuthService);
  protected readonly name = computed(() => this.auth.user()?.displayName ?? '');
  private readonly list = signal<DeviceList>({ microphones: [], cameras: [] });
  protected readonly microphones = computed(() => options(this.list().microphones, 'Микрофон'));
  protected readonly cameras = computed(() => options(this.list().cameras, 'Камера'));
  private readonly preview = viewChild<ElementRef<HTMLVideoElement>>('preview');
  private request = 0;

  constructor() {
    effect(() => {
      const element = this.preview()?.nativeElement;
      if (element !== undefined) {
        element.srcObject = this.stream();
      }
    });
    inject(DestroyRef).onDestroy(() => {
      this.request += 1;
      stop(this.stream());
    });
    void this.restart();
  }

  update(change: Partial<CallMedia>): void {
    const before = this.media();
    this.media.set({ ...before, ...change });
    const devicesChanged =
      change.camera !== undefined ||
      change.microphone !== undefined ||
      (change.cameraId !== undefined && change.cameraId !== before.cameraId) ||
      (change.microphoneId !== undefined && change.microphoneId !== before.microphoneId);
    if (devicesChanged) {
      void this.restart();
    }
  }

  protected cancel(): void {
    this.session.cancelPrejoin();
  }

  protected join(): void {
    this.request += 1;
    stop(this.stream());
    this.stream.set(null);
    void this.session.join(this.media());
  }

  /** A new preview of the chosen devices; the device names come once access is given. */
  private async restart(): Promise<void> {
    if (!this.supported) {
      return;
    }
    const request = ++this.request;
    stop(this.stream());
    this.stream.set(null);
    try {
      const stream = await this.devices.preview(this.media());
      if (request !== this.request) {
        stop(stream);
        return;
      }
      this.stream.set(stream);
      this.error.set(null);
      this.list.set(await this.devices.list());
    } catch (error: unknown) {
      if (request === this.request) {
        this.error.set(mediaErrorText(error));
      }
    }
  }
}

function options(devices: readonly MediaDeviceInfo[], kind: string): DeviceOption[] {
  return devices.map((device, index) => ({
    label: device.label || `${kind} ${String(index + 1)}`,
    value: device.deviceId,
  }));
}

function stop(stream: MediaStream | null): void {
  stream?.getTracks().forEach((track) => {
    track.stop();
  });
}
