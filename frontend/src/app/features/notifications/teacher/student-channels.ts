import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { Button } from 'primeng/button';
import { Snackbar } from '@core/snackbar/snackbar';
import { LoadState } from '@shared/ui/load-state';
import { LoadStateView } from '@shared/ui/load-state-view';
import { NotificationsApi } from '../data-access/notifications-api';
import { ChannelState, ChannelType, StudentMessengers } from '../data-access/notifications.models';
import { CHANNEL_ICONS, CHANNEL_NAMES } from '../notification-labels';
import { T } from '../i18n/texts';

const ALL_CHANNELS: readonly ChannelType[] = ['TELEGRAM', 'VK', 'MAX'];

/**
 * «Связь» of a student's card (redesign spec §8): the messengers the student connected, the messages
 * not delivered lately; without a messenger — «Напомнить», the same reminder as in the messengers list.
 */
@Component({
  selector: 'tb-student-channels',
  imports: [Button, DatePipe, LoadStateView],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: block' },
  styles: `
    .tb-student-channels__remind {
      display: block;
      margin-top: var(--tb-space-3);
    }
  `,
  template: `
    <tb-load-state [state]="state" [what]="t.what" (retry)="load()">
      @if (messengers(); as messengers) {
        <ul class="tb-list tb-list--no-phone-lead" [attr.aria-label]="t.title">
          @for (row of rows(messengers); track row.type) {
            <li>
              <span class="tb-list__lead" aria-hidden="true"
                ><i [class]="icons[row.type]"></i
              ></span>
              <div class="tb-list__text">
                <span class="tb-list__title">{{ names[row.type] }}</span>
                <span class="tb-list__supporting">
                  @if (row.channel; as channel) {
                    @if (channel.displayName) {
                      {{ channel.displayName }} ·
                    }
                    @if (!channel.enabled) {
                      {{ t.paused }}
                    } @else if (channel.linkedAt !== null) {
                      {{ t.since((channel.linkedAt | date: 'd MMMM') ?? '') }}
                    }
                  } @else {
                    {{ t.notConnected }}
                  }
                </span>
              </div>
            </li>
          }
          @if (messengers.failedDeliveries > 0) {
            <li>
              <span class="tb-list__lead tb-list__lead--accent" aria-hidden="true"
                ><i class="tb-i tb-i-warning"></i
              ></span>
              <div class="tb-list__text">
                <span class="tb-list__title">{{ t.failed(messengers.failedDeliveries) }}</span>
                <span class="tb-list__supporting">{{ t.failedHint }}</span>
              </div>
            </li>
          }
        </ul>
        <p-button
          class="tb-student-channels__remind"
          [label]="t.remind"
          icon="tb-i tb-i-share"
          severity="secondary"
          [loading]="pending()"
          (onClick)="remind(messengers.studentId)"
        />
      }
    </tb-load-state>
  `,
})
export class StudentChannels {
  protected readonly t = T.studentChannels;
  protected readonly icons = CHANNEL_ICONS;
  protected readonly names = CHANNEL_NAMES;
  private readonly api = inject(NotificationsApi);
  private readonly snackbar = inject(Snackbar);

  readonly studentId = input.required<string>();

  protected readonly state = new LoadState();
  protected readonly messengers = signal<StudentMessengers | null>(null);
  protected readonly pending = signal(false);

  constructor() {
    effect(() => {
      this.studentId();
      untracked(() => {
        this.load();
      });
    });
  }

  /** Every messenger of the portal: the student's one, or «Не подключён» (sketch Details). */
  protected rows(messengers: StudentMessengers): { type: ChannelType; channel?: ChannelState }[] {
    return ALL_CHANNELS.map((type) => ({
      type,
      channel: messengers.channels.find((channel) => channel.channel === type),
    }));
  }

  protected load(): void {
    this.api
      .studentChannels(this.studentId())
      .pipe(this.state.track())
      .subscribe((messengers) => {
        this.messengers.set(messengers);
      });
  }

  protected remind(studentId: string): void {
    this.pending.set(true);
    this.api.remindToConnect([studentId]).subscribe({
      next: () => {
        this.pending.set(false);
        this.snackbar.success(this.t.reminded);
      },
      error: () => {
        this.pending.set(false);
      },
    });
  }
}
