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
import { countOf } from '@shared/text/plural';
import { EmptyState } from '@shared/ui/empty-state';
import { InitialsPipe } from '@shared/ui/initials';
import { LoadState } from '@shared/ui/load-state';
import { LoadStateView } from '@shared/ui/load-state-view';
import { PageHeader } from '@shared/ui/page-header';
import { CallSession } from '../call/call-session';
import { MeetingsApi } from '../data-access/meetings-api';
import { CallCard, CallsOverview } from '../data-access/meetings.models';

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
  imports: [
    Button,
    Card,
    Message,
    Tag,
    HelpButton,
    EmptyState,
    InitialsPipe,
    LoadStateView,
    PageHeader,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <tb-page-header title="Звонки">
      <tb-help-button help topic="teacher/calls" />
    </tb-page-header>

    <p-card>
      <h2 class="tb-sr-only">Комнаты учеников и групп</h2>
      <tb-load-state [state]="state" what="комнаты" (retry)="load()">
        @if (overview(); as overview) {
          @if (overview.status === 'OFF') {
            <tb-empty-state
              icon="pi-video"
              title="Звонки в портале не настроены"
              hint="Их включает администратор портала: нужен сервер звонков LiveKit. Пока уроки идут по внешним ссылкам."
            />
          } @else {
            @if (overview.status === 'UNREACHABLE') {
              <p-message severity="warn" styleClass="tb-form-message">
                Сервер звонков не отвечает: не видно, кто в комнатах. Войти, скорее всего, тоже не
                получится.
              </p-message>
            }
            @if (overview.rooms.length === 0) {
              <tb-empty-state
                icon="pi-users"
                title="Пока нет учеников и групп"
                hint="У каждого ученика и каждой группы появится своя комната."
              />
            } @else {
              <ul class="tb-list" aria-label="Комнаты">
                @for (room of overview.rooms; track room.ownerId) {
                  <li>
                    @if (room.ownerType === 'GROUP') {
                      <span class="tb-list__lead" aria-hidden="true"
                        ><i class="pi pi-users"></i
                      ></span>
                    } @else {
                      <span class="tb-avatar" aria-hidden="true">{{ room.name | initials }}</span>
                    }
                    <div class="tb-list__text">
                      <span class="tb-list__title">{{ room.name }}</span>
                      <span class="tb-list__supporting">{{ details(room) }}</span>
                    </div>
                    <div class="tb-list__trail tb-list__trail--icons">
                      <p-tag [value]="status(room).label" [severity]="status(room).severity" />
                      @if (current() === room.ownerId) {
                        <p-button
                          label="Развернуть"
                          icon="pi pi-window-maximize"
                          severity="secondary"
                          [ariaLabel]="'Развернуть звонок: ' + room.name"
                          (onClick)="session.expand()"
                        />
                      } @else {
                        <p-button
                          label="Войти"
                          icon="pi pi-video"
                          severity="secondary"
                          [ariaLabel]="'Войти в звонок: ' + room.name"
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
      return { label: 'Вы в звонке', severity: undefined };
    }
    if (room.waiting.length > 0) {
      return { label: `Ждут: ${String(room.waiting.length)}`, severity: 'warn' };
    }
    return { label: 'Пусто', severity: 'secondary' };
  }

  /** Who is there, or what the room is. */
  protected details(room: CallCard): string {
    const parts: string[] = [];
    if (room.waiting.length > 0) {
      parts.push(`В звонке: ${room.waiting.map((name) => name.trim() || 'Участник').join(', ')}`);
    } else if (room.ownerType === 'GROUP') {
      parts.push(`Группа, ${countOf(room.members, 'ученик', 'ученика', 'учеников')}`);
    } else {
      parts.push('Комната ученика');
    }
    if (room.externalLink) {
      parts.push('в занятиях — своя ссылка');
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
