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
import { StudentMessengers } from '../data-access/notifications.models';
import { CHANNEL_ICONS, CHANNEL_NAMES } from '../notification-labels';
import { T } from '../i18n/texts';

/**
 * «Связь» of a student's card (redesign spec §8): the messengers the student connected, the messages
 * not delivered lately; without a messenger — «Напомнить», the same reminder as in the messengers list.
 */
@Component({
  selector: 'tb-student-channels',
  imports: [Button, DatePipe, LoadStateView],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: block' },
  template: `
    <tb-load-state [state]="state" [what]="t.what" (retry)="load()">
      @if (messengers(); as messengers) {
        <ul class="tb-list tb-list--no-phone-lead" [attr.aria-label]="t.title">
          @for (channel of messengers.channels; track channel.channel) {
            <li>
              <span class="tb-list__lead" aria-hidden="true"
                ><i [class]="icons[channel.channel]"></i
              ></span>
              <div class="tb-list__text">
                <span class="tb-list__title">{{ t.connected(names[channel.channel]) }}</span>
                <span class="tb-list__supporting">
                  @if (!channel.enabled) {
                    {{ t.paused }}
                  } @else if (channel.linkedAt !== null) {
                    {{ t.since((channel.linkedAt | date: 'dd.MM.yyyy') ?? '') }}
                  }
                </span>
              </div>
            </li>
          } @empty {
            <li>
              <span class="tb-list__lead" aria-hidden="true"
                ><i class="tb-i tb-i-notifications_off"></i
              ></span>
              <div class="tb-list__text">
                <span class="tb-list__title">{{ t.none }}</span>
                <span class="tb-list__supporting">{{ t.noneHint }}</span>
              </div>
              <div class="tb-list__trail">
                <p-button
                  [label]="t.remind"
                  severity="secondary"
                  [text]="true"
                  [loading]="pending()"
                  (onClick)="remind(messengers.studentId)"
                />
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
