import {
  ChangeDetectionStrategy,
  Component,
  DOCUMENT,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { Message } from 'primeng/message';
import { Tag } from 'primeng/tag';
import { quietContext } from '@core/http/api-error.interceptor';
import { HelpButton } from '@features/help/parts';
import { EmptyState } from '@shared/ui/empty-state';
import { Avatar } from '@shared/ui/avatar';
import { LoadState } from '@shared/ui/load-state';
import { LoadStateView } from '@shared/ui/load-state-view';
import { PageHeader } from '@shared/ui/page-header';
import { CallSession } from '../call/call-session';
import { MeetingsApi } from '../data-access/meetings-api';
import { CallCard, CallsOverview } from '../data-access/meetings.models';
import { T } from '../i18n/texts';

/** How often the page asks who is in the rooms while it is visible. */
export const CALLS_REFRESH_MS = 10_000;

/** The status of a room on its card. */
interface RoomStatus {
  readonly label: string;
  /** No severity is the main state: primary container (design system §2). */
  readonly severity: 'secondary' | 'warn' | undefined;
}

/**
 * Teacher: the built-in room of every current student and active group (ADR-0030) — a simple card:
 * who it is on the left, «Войти» on the right, the room's status between («Пусто», «Ждут: N»,
 * «Вы в звонке»). Refreshes itself while the page is visible.
 */
@Component({
  selector: 'tb-calls-page',
  imports: [Button, Card, Message, Tag, HelpButton, EmptyState, Avatar, LoadStateView, PageHeader],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <tb-page-header [title]="t.title">
      <tb-help-button help topic="teacher/calls" />
    </tb-page-header>

    <p-card>
      <h2 class="tb-sr-only">{{ t.rooms }}</h2>
      <tb-load-state [state]="state" [what]="t.what" (retry)="load()">
        @if (overview(); as overview) {
          @if (overview.status === 'OFF') {
            <tb-empty-state icon="tb-i-videocam" [title]="t.offTitle" [hint]="t.offHint" />
          } @else {
            @if (overview.status === 'UNREACHABLE') {
              <p-message severity="warn" styleClass="tb-form-message">{{
                t.unreachable
              }}</p-message>
            }
            @if (overview.rooms.length === 0) {
              <tb-empty-state icon="tb-i-group" [title]="t.emptyTitle" [hint]="t.emptyHint" />
            } @else {
              <ul class="tb-list" [attr.aria-label]="t.list">
                @for (room of overview.rooms; track room.ownerId) {
                  <li>
                    @if (room.ownerType === 'GROUP') {
                      <span class="tb-list__lead" aria-hidden="true"
                        ><i class="tb-i tb-i-group"></i
                      ></span>
                    } @else {
                      <tb-avatar [name]="room.name" [photo]="room.avatar" />
                    }
                    <div class="tb-list__text">
                      <span class="tb-list__title">{{ room.name }}</span>
                      <span class="tb-list__supporting">{{ details(room) }}</span>
                    </div>
                    <div class="tb-list__trail tb-list__trail--icons">
                      <p-tag [value]="status(room).label" [severity]="status(room).severity" />
                      @if (current() === room.ownerId) {
                        <p-button
                          [label]="t.expand"
                          icon="tb-i tb-i-open_in_full"
                          severity="secondary"
                          [ariaLabel]="t.expandOf(room.name)"
                          (onClick)="session.expand()"
                        />
                      } @else {
                        <p-button
                          [label]="t.join"
                          icon="tb-i tb-i-videocam"
                          severity="secondary"
                          [ariaLabel]="t.joinOf(room.name)"
                          [loading]="session.opening() === room.ownerId"
                          (onClick)="session.open(room.ownerId)"
                        />
                      }
                    </div>
                  </li>
                }
              </ul>
            }
          }
        }
      </tb-load-state>
    </p-card>
  `,
})
export class CallsPage implements OnInit {
  protected readonly t = T.calls;
  private readonly api = inject(MeetingsApi);
  private readonly document = inject(DOCUMENT);
  protected readonly session = inject(CallSession);

  protected readonly overview = signal<CallsOverview | null>(null);
  protected readonly state = new LoadState();
  /** The room of the call going on in this tab. */
  protected readonly current = computed(() =>
    this.session.live() ? (this.session.target()?.ownerId ?? null) : null,
  );

  constructor() {
    const timer = setInterval(() => {
      if (this.document.visibilityState === 'visible') {
        this.refresh();
      }
    }, CALLS_REFRESH_MS);
    // back to a hidden tab: show the rooms as they are now
    const visible = (): void => {
      if (this.document.visibilityState === 'visible') {
        this.refresh();
      }
    };
    this.document.addEventListener('visibilitychange', visible);
    inject(DestroyRef).onDestroy(() => {
      clearInterval(timer);
      this.document.removeEventListener('visibilitychange', visible);
    });
  }

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.api
      .calls(quietContext())
      .pipe(this.state.track())
      .subscribe((overview) => {
        this.overview.set(overview);
      });
  }

  protected status(room: CallCard): RoomStatus {
    if (room.teacherPresent || this.current() === room.ownerId) {
      return { label: T.calls.inCall, severity: undefined };
    }
    if (room.waiting.length > 0) {
      return { label: T.calls.waiting(room.waiting.length), severity: 'warn' };
    }
    return { label: T.calls.empty, severity: 'secondary' };
  }

  /** Who is there, or what the room is. */
  protected details(room: CallCard): string {
    const parts: string[] = [];
    if (room.waiting.length > 0) {
      parts.push(
        T.calls.present(room.waiting.map((name) => name.trim() || T.participant).join(', ')),
      );
    } else if (room.ownerType === 'GROUP') {
      parts.push(T.calls.group(room.members));
    } else {
      parts.push(T.calls.studentRoom);
    }
    if (room.externalLink) {
      parts.push(T.calls.ownLink);
    }
    return parts.join(' · ');
  }

  /** A quiet refresh: a failure keeps what is shown; after a failed load — the load again. */
  private refresh(): void {
    if (this.state.status() !== 'ready') {
      this.load();
      return;
    }
    this.api.calls(quietContext()).subscribe({
      next: (overview) => {
        this.overview.set(overview);
      },
      error: () => undefined,
    });
  }
}
