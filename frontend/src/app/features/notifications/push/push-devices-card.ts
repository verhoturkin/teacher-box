import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { Message } from 'primeng/message';
import { WebPush } from '@core/push/web-push';
import type { PushDevice } from '@core/push/web-push';
import { Snackbar } from '@core/snackbar/snackbar';
import { Busy } from '@shared/ui/busy';
import { T } from '../i18n/texts';
import { deviceName } from './device-name';

/**
 * «Мой аккаунт»: web push of the user (ADR-0051). One button turns it on for this browser (a click,
 * because the permission prompt needs a gesture); the list shows every device with «Отключить».
 */
@Component({
  selector: 'tb-push-devices-card',
  imports: [DatePipe, Button, Card, Message],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-card [header]="t.header">
      <p class="tb-muted">{{ t.about }}</p>
      @if (push.needsHomeScreen) {
        <p-message severity="info" styleClass="tb-form-message">{{ t.homeScreen }}</p-message>
      } @else if (!push.supported) {
        <p-message severity="secondary" styleClass="tb-form-message">{{ t.unsupported }}</p-message>
      } @else if (push.denied()) {
        <p-message severity="warn" styleClass="tb-form-message">{{ t.denied }}</p-message>
      } @else if (push.devices() !== null && !push.enabledHere()) {
        <div class="tb-actions">
          <p-button
            [label]="t.enable"
            icon="tb-i tb-i-notifications"
            [loading]="busy.is('enable')"
            (onClick)="enable()"
          />
        </div>
      }
      @if (push.devices(); as devices) {
        @if (devices.length > 0) {
          <ul class="tb-list tb-devices">
            @for (device of devices; track device.id) {
              <li>
                <span class="tb-list__lead" aria-hidden="true"
                  ><i class="tb-i tb-i-notifications"></i
                ></span>
                <div class="tb-list__text">
                  <span class="tb-list__title">
                    {{ name(device) }}
                    @if (push.isThisDevice(device)) {
                      <span class="tb-muted">· {{ t.thisDevice }}</span>
                    }
                  </span>
                  <span class="tb-list__supporting">
                    {{ t.since((device.createdAt | date: 'dd.MM.yyyy') ?? '') }}
                    @if (device.failing) {
                      · {{ t.failing }}
                    }
                  </span>
                </div>
                <div class="tb-list__trail">
                  <p-button
                    [label]="t.disable"
                    [ariaLabel]="t.disableOf(name(device))"
                    severity="danger"
                    [text]="true"
                    [loading]="busy.is('disable-' + device.id)"
                    (onClick)="disable(device)"
                  />
                </div>
              </li>
            }
          </ul>
        }
      }
    </p-card>
  `,
  styles: `
    .tb-devices {
      margin-top: var(--tb-space-3);
    }
  `,
})
export class PushDevicesCard implements OnInit {
  protected readonly t = T.push;
  protected readonly push = inject(WebPush);
  protected readonly busy = new Busy();
  private readonly snackbar = inject(Snackbar);

  ngOnInit(): void {
    this.push.load();
  }

  protected name(device: PushDevice): string {
    return deviceName(device.userAgent, this.t.unknownDevice);
  }

  enable(): void {
    this.busy.guard('enable', this.push.enable()).subscribe({
      next: () => {
        this.snackbar.success(this.t.enabled);
      },
      error: () => {
        this.snackbar.error(this.push.denied() ? this.t.denied : this.t.failed);
      },
    });
  }

  disable(device: PushDevice): void {
    this.busy.guard('disable-' + device.id, this.push.disable(device)).subscribe(() => {
      this.snackbar.info(this.t.disabled);
    });
  }
}
