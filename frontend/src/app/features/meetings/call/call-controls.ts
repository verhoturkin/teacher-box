import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { MenuItem } from 'primeng/api';
import { Button } from 'primeng/button';
import { Menu } from 'primeng/menu';
import { injectMobile } from '@core/layout/mobile';
import { ButtonAttributes } from '@shared/ui/button-attributes';
import { CallDevices, DeviceList } from './call-devices';
import { AudioProcessing } from './call-engine';
import { CallSession } from './call-session';
import { CallStatsDialog } from './call-stats-dialog';

/**
 * The buttons of a call (M3 Expressive toolbar): microphone and camera toggles (error-coloured while
 * off), screen sharing, devices, minimize/expand and the red «Выйти»; no tooltips, the labels are for
 * screen readers. The compact set is for the mini window.
 */
@Component({
  selector: 'tb-call-controls',
  imports: [Button, Menu, ButtonAttributes, CallStatsDialog],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'tb-call-controls', role: 'toolbar', 'aria-label': 'Управление звонком' },
  template: `
    <p-button
      [styleClass]="toggleClass(session.microphone())"
      icon="pi pi-microphone"
      [rounded]="true"
      [severity]="session.microphone() ? 'secondary' : 'danger'"
      [ariaLabel]="'Микрофон'"
      [tbAttributes]="{ 'aria-pressed': session.microphone() ? 'true' : 'false' }"
      [disabled]="!connected()"
      (onClick)="session.toggleMicrophone()"
    />
    <p-button
      [styleClass]="toggleClass(session.camera())"
      icon="pi pi-video"
      [rounded]="true"
      [severity]="session.camera() ? 'secondary' : 'danger'"
      [ariaLabel]="'Камера'"
      [tbAttributes]="{ 'aria-pressed': session.camera() ? 'true' : 'false' }"
      [disabled]="!connected()"
      (onClick)="session.toggleCamera()"
    />
    @if (!compact()) {
      @if (canShare && !mobile()) {
        <p-button
          [styleClass]="'tb-call-button' + (session.screen() ? ' tb-call-button--active' : '')"
          icon="pi pi-desktop"
          [rounded]="true"
          [severity]="session.screen() ? undefined : 'secondary'"
          [ariaLabel]="'Показ экрана'"
          [tbAttributes]="{ 'aria-pressed': session.screen() ? 'true' : 'false' }"
          [disabled]="!connected()"
          (onClick)="session.toggleScreen()"
        />
      }
      <p-button
        styleClass="tb-call-button"
        icon="pi pi-cog"
        [rounded]="true"
        severity="secondary"
        ariaLabel="Настройки звонка"
        [tbAttributes]="{ 'aria-haspopup': 'menu', 'aria-expanded': menuOpen() ? 'true' : 'false' }"
        [disabled]="!connected()"
        (onClick)="openDevices($event, menu)"
      />
      <p-menu
        #menu
        [model]="deviceItems()"
        [popup]="true"
        appendTo="body"
        [baseZIndex]="menuLayer"
        styleClass="tb-call-menu"
        (onShow)="menuOpen.set(true)"
        (onHide)="menuOpen.set(false)"
      />
      @if (statsOpen()) {
        <tb-call-stats-dialog (closed)="statsOpen.set(false)" />
      }
      <p-button
        styleClass="tb-call-button"
        icon="pi pi-window-minimize"
        [rounded]="true"
        severity="secondary"
        ariaLabel="Свернуть"
        (onClick)="session.minimize()"
      />
    } @else {
      <p-button
        styleClass="tb-call-button"
        icon="pi pi-window-maximize"
        [rounded]="true"
        severity="secondary"
        ariaLabel="Развернуть"
        (onClick)="session.expand()"
      />
    }
    <p-button
      styleClass="tb-call-button tb-call-button--leave"
      icon="pi pi-phone"
      [rounded]="true"
      severity="danger"
      ariaLabel="Выйти из звонка"
      (onClick)="session.leave()"
    />
  `,
})
export class CallControls {
  protected readonly session = inject(CallSession);
  private readonly devices = inject(CallDevices);

  /** The mini window: microphone, camera, expand, leave. */
  readonly compact = input(false);

  protected readonly canShare = this.devices.canShareScreen();
  /** Phones share no screen, and the toolbar keeps to one line. */
  protected readonly mobile = injectMobile();
  protected readonly connected = computed(() => this.session.phase() === 'connected');
  protected readonly menuOpen = signal(false);
  protected readonly statsOpen = signal(false);
  /** PrimeNG menus start at z-index 1000, under the call window (1050 in `styles.scss`). */
  protected readonly menuLayer = 100;
  private readonly deviceList = signal<DeviceList>({ microphones: [], cameras: [] });

  protected readonly deviceItems = computed<MenuItem[]>(() => {
    const list = this.deviceList();
    const media = this.session.media();
    const group = (
      label: string,
      kind: 'audioinput' | 'videoinput',
      devices: readonly MediaDeviceInfo[],
      chosen: string | null,
    ): MenuItem => ({
      label,
      items:
        devices.length === 0
          ? [{ label: 'Не найдено', disabled: true }]
          : devices.map((device, index) => {
              const selected = chosen === null ? index === 0 : chosen === device.deviceId;
              return {
                label: device.label || `${label} ${String(index + 1)}`,
                icon: selected ? 'pi pi-check' : 'pi pi-circle-off tb-call-menu__blank',
                styleClass: selected ? 'tb-menu-item--selected' : undefined,
                command: () => {
                  void this.session.switchDevice(kind, device.deviceId);
                },
              };
            }),
    });
    const processing = this.session.audioProcessing();
    const toggle = (label: string, key: keyof AudioProcessing): MenuItem => ({
      label,
      icon: processing[key] ? 'pi pi-check' : 'pi pi-circle-off tb-call-menu__blank',
      styleClass: processing[key] ? 'tb-menu-item--selected' : undefined,
      command: () => {
        void this.session.setAudioProcessing({ ...processing, [key]: !processing[key] });
      },
    });
    return [
      group('Микрофон', 'audioinput', list.microphones, media.microphoneId),
      group('Камера', 'videoinput', list.cameras, media.cameraId),
      {
        label: 'Обработка звука',
        items: [
          toggle('Эхоподавление', 'echoCancellation'),
          toggle('Шумоподавление', 'noiseSuppression'),
          toggle('Автоусиление громкости', 'autoGainControl'),
        ],
      },
      {
        label: 'Связь',
        items: [
          {
            label: 'Сведения о связи',
            icon: 'pi pi-chart-bar',
            command: () => {
              this.statsOpen.set(true);
            },
          },
        ],
      },
    ];
  });

  protected toggleClass(on: boolean): string {
    return on ? 'tb-call-button' : 'tb-call-button tb-call-button--off';
  }

  protected openDevices(event: Event, menu: Menu): void {
    const target = event.currentTarget;
    void this.devices.list().then((list) => {
      this.deviceList.set(list);
      menu.show({ currentTarget: target });
    });
  }
}
