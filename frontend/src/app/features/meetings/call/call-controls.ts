import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { MenuItem } from 'primeng/api';
import { Button } from 'primeng/button';
import { Menu } from 'primeng/menu';
import { Tooltip } from 'primeng/tooltip';
import { injectMobile } from '@core/layout/mobile';
import { ButtonAttributes } from '@shared/ui/button-attributes';
import { CallDevices, DeviceList } from './call-devices';
import { CallSession } from './call-session';

/**
 * The buttons of a call (M3 Expressive toolbar): microphone and camera toggles (round while on, a
 * squarer error-coloured shape while off), screen sharing, devices, minimize/expand and the red
 * «Выйти». The compact set is for the mini window.
 */
@Component({
  selector: 'tb-call-controls',
  imports: [Button, Menu, Tooltip, ButtonAttributes],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'tb-call-controls', role: 'toolbar', 'aria-label': 'Управление звонком' },
  template: `
    <p-button
      [styleClass]="toggleClass(session.microphone())"
      icon="pi pi-microphone"
      [rounded]="true"
      [severity]="session.microphone() ? 'secondary' : 'danger'"
      [ariaLabel]="'Микрофон'"
      [pTooltip]="session.microphone() ? 'Выключить микрофон' : 'Включить микрофон'"
      tooltipPosition="top"
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
      [pTooltip]="session.camera() ? 'Выключить камеру' : 'Включить камеру'"
      tooltipPosition="top"
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
          [pTooltip]="session.screen() ? 'Остановить показ экрана' : 'Показать экран'"
          tooltipPosition="top"
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
        ariaLabel="Устройства"
        pTooltip="Устройства"
        tooltipPosition="top"
        [tbAttributes]="{ 'aria-haspopup': 'menu', 'aria-expanded': menuOpen() ? 'true' : 'false' }"
        [disabled]="!connected()"
        (onClick)="openDevices($event, menu)"
      />
      <p-menu
        #menu
        [model]="deviceItems()"
        [popup]="true"
        appendTo="body"
        styleClass="tb-call-menu"
        (onShow)="menuOpen.set(true)"
        (onHide)="menuOpen.set(false)"
      />
      <p-button
        styleClass="tb-call-button"
        icon="pi pi-window-minimize"
        [rounded]="true"
        severity="secondary"
        ariaLabel="Свернуть"
        pTooltip="Свернуть: продолжить работу в портале"
        tooltipPosition="top"
        (onClick)="session.minimize()"
      />
    } @else {
      <p-button
        styleClass="tb-call-button"
        icon="pi pi-window-maximize"
        [rounded]="true"
        severity="secondary"
        ariaLabel="Развернуть"
        pTooltip="Развернуть"
        tooltipPosition="top"
        (onClick)="session.expand()"
      />
    }
    <p-button
      styleClass="tb-call-button tb-call-button--leave"
      icon="pi pi-phone"
      [rounded]="true"
      severity="danger"
      ariaLabel="Выйти из звонка"
      pTooltip="Выйти из звонка"
      tooltipPosition="top"
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
    return [
      group('Микрофон', 'audioinput', list.microphones, media.microphoneId),
      group('Камера', 'videoinput', list.cameras, media.cameraId),
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
