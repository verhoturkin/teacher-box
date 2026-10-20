import { Clipboard } from '@angular/cdk/clipboard';
import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { catchError, forkJoin, of } from 'rxjs';
import { Button } from 'primeng/button';
import { Tooltip } from 'primeng/tooltip';
import { quietContext } from '@core/http/api-error.interceptor';
import { Snackbar } from '@core/snackbar/snackbar';
import { LoadState } from '@shared/ui/load-state';
import { LoadStateView } from '@shared/ui/load-state-view';
import { MeetingsApi } from '../data-access/meetings-api';
import { MeetingRoom, RoomOwnerRef } from '../data-access/meetings.models';
import { T } from '../i18n/texts';

/**
 * «Связь» of a student's or a group's card (redesign spec §8): where the lessons take place — the external
 * call link with «copy», the room of the portal, or no link yet. Read only: the link is set where the
 * student or the group is edited (`tb-room-panel`).
 */
@Component({
  selector: 'tb-room-link',
  imports: [Button, LoadStateView, Tooltip],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: block' },
  template: `
    <tb-load-state [state]="state" [what]="t.what" (retry)="load()">
      <ul class="tb-list tb-list--no-phone-lead" [attr.aria-label]="t.title">
        <li>
          <span class="tb-list__lead" aria-hidden="true"><i class="tb-i tb-i-videocam"></i></span>
          @if (room(); as room) {
            <div class="tb-list__text">
              <span class="tb-list__title">{{ t.external }}</span>
              <a
                class="tb-list__supporting tb-room-link__url"
                [href]="room.joinUrl"
                target="_blank"
                rel="noopener"
                >{{ room.joinUrl }}</a
              >
            </div>
            <div class="tb-list__trail tb-list__trail--icons">
              <p-button
                icon="tb-i tb-i-content_copy"
                [text]="true"
                [rounded]="true"
                severity="secondary"
                [pTooltip]="t.copy"
                [ariaLabel]="t.copy"
                (onClick)="copy(room.joinUrl)"
              />
            </div>
          } @else if (callsOn()) {
            <div class="tb-list__text">
              <span class="tb-list__title">{{ t.portal }}</span>
              <span class="tb-list__supporting">{{ t.portalHint }}</span>
            </div>
          } @else {
            <div class="tb-list__text">
              <span class="tb-list__title">{{ t.none }}</span>
              <span class="tb-list__supporting">{{ t.noneHint }}</span>
            </div>
          }
        </li>
      </ul>
    </tb-load-state>
  `,
  styles: `
    .tb-room-link__url {
      overflow-wrap: anywhere;
    }
  `,
})
export class RoomLink {
  protected readonly t = T.roomLink;
  private readonly api = inject(MeetingsApi);
  private readonly clipboard = inject(Clipboard);
  private readonly snackbar = inject(Snackbar);

  /** The student or the group whose lessons it is about. */
  readonly owner = input.required<RoomOwnerRef>();

  protected readonly state = new LoadState();
  protected readonly room = signal<MeetingRoom | null>(null);
  /** Built-in calls are set up: without a link the lessons take place in the room of the portal. */
  protected readonly callsOn = signal(false);

  constructor() {
    effect(() => {
      this.owner();
      untracked(() => {
        this.load();
      });
    });
  }

  protected load(): void {
    const ownerId = this.owner().id;
    forkJoin({
      rooms: this.api.rooms(quietContext()),
      // the status only changes the words: without it the card reads as with calls off
      calls: this.api.calls(quietContext()).pipe(catchError(() => of(null))),
    })
      .pipe(this.state.track())
      .subscribe(({ rooms, calls }) => {
        this.room.set(rooms.find((room) => room.ownerId === ownerId) ?? null);
        this.callsOn.set(calls !== null && calls.status !== 'OFF');
      });
  }

  protected copy(text: string): void {
    if (this.clipboard.copy(text)) {
      this.snackbar.success(T.room.copied);
    }
  }
}
