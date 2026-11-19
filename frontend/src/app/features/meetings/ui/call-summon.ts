import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, interval, of, startWith, switchMap } from 'rxjs';
import { Button } from 'primeng/button';
import { quietContext } from '@core/http/api-error.interceptor';
import { Snackbar } from '@core/snackbar/snackbar';
import { Busy } from '@shared/ui/busy';
import { MeetingsApi } from '../data-access/meetings-api';
import { CallCard, CallsOverview } from '../data-access/meetings.models';
import { T } from '../i18n/texts';

/** How often the presence in the room is asked again while the line is shown. */
export const SUMMON_REFRESH_MS = 10_000;

/**
 * «Позвать» (sketch «Сегодня — один урок», boards 1 and 4): while a lesson runs in the portal's room,
 * «<Имя> ещё не в звонке» with a small text button that sends the absent students a notice with the
 * call; a group — «Позвать остальных». Everybody in and the teacher not — «<Имя> ждёт в звонке» /
 * «Все ждут в звонке». Shows nothing while the presence is unknown (calls off, the media server down,
 * an external room) or everyone, the teacher too, is in.
 */
@Component({
  selector: 'tb-call-summon',
  imports: [Button],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.tb-call-summon--hero]': 'hero()' },
  template: `
    @if (hero()) {
      <span class="tb-button-group tb-call-summon__actions">
        <ng-content />
        @if (absent(); as card) {
          <p-button
            [label]="card.ownerType === 'GROUP' ? t.summonRest : t.summon"
            icon="tb-i tb-i-notifications_active"
            severity="secondary"
            styleClass="tb-button-m"
            [loading]="busy.is()"
            (onClick)="summon(card)"
          />
        }
      </span>
      @if (absent(); as card) {
        <span class="tb-call-summon__line">
          <i class="tb-i tb-i-person_off" aria-hidden="true"></i>
          <span class="tb-call-summon__text">{{ line(card) }}</span>
        </span>
      } @else if (waiting(); as card) {
        <span class="tb-call-summon__line">
          <i class="tb-i tb-i-video_call" aria-hidden="true"></i>
          <span class="tb-call-summon__text" role="status">{{ waitingLine(card) }}</span>
        </span>
      }
    } @else if (absent(); as card) {
      <i class="tb-i tb-i-person_off" aria-hidden="true"></i>
      <span class="tb-call-summon__text">{{ line(card) }}</span>
      <p-button
        [label]="card.ownerType === 'GROUP' ? t.summonRest : t.summon"
        [text]="true"
        styleClass="tb-button-xs"
        [loading]="busy.is()"
        (onClick)="summon(card)"
      />
    } @else if (waiting(); as card) {
      <i class="tb-i tb-i-video_call" aria-hidden="true"></i>
      <span class="tb-call-summon__text" role="status">{{ waitingLine(card) }}</span>
    }
  `,
  styles: `
    :host {
      display: flex;
      align-items: center;
      gap: var(--tb-space-2);
      min-width: 0;
      font: var(--tb-type-body-s);
    }

    :host:empty {
      display: none;
    }

    .tb-i {
      font-size: 1.125rem;
    }

    .tb-call-summon__text {
      flex: 1;
      min-width: 0;
    }

    /*
     * The hero of the teacher's Today (board D): the host gives way to the hero's grid; the join button
     * (content) and «Позвать» are its standard button group (area actions), the line goes under the
     * name (area presence)
     */
    :host(.tb-call-summon--hero) {
      display: contents;
    }

    .tb-call-summon__actions {
      grid-area: actions;
    }

    .tb-call-summon__line {
      grid-area: presence;
      display: flex;
      align-items: center;
      gap: var(--tb-space-2);
      min-width: 0;
      font: var(--tb-type-body-m);
    }
  `,
})
export class CallSummon {
  protected readonly t = T.summon;
  private readonly api = inject(MeetingsApi);
  private readonly snackbar = inject(Snackbar);
  protected readonly busy = new Busy();

  /** The student or the group of the running lesson. */
  readonly ownerId = input.required<string>();
  /**
   * The hero of the teacher's Today: the projected join button and a medium «Позвать» form one button
   * group, the line stands apart (the host takes no box of its own).
   */
  readonly hero = input(false);

  private readonly calls = signal<CallsOverview | null>(null);
  /** The room of the lesson while its presence is known. */
  private readonly room = computed(() => {
    const calls = this.calls();
    const card = calls?.rooms.find((room) => room.ownerId === this.ownerId());
    return calls?.status === 'OK' && card !== undefined && !card.externalLink ? card : null;
  });
  /** The room while somebody of it is not in the call. */
  protected readonly absent = computed(() => {
    const card = this.room();
    return card !== null && card.waiting.length < card.members ? card : null;
  });
  /** The room while all of it is in the call and the teacher is not. */
  protected readonly waiting = computed(() => {
    const card = this.room();
    return card !== null && card.waiting.length >= card.members && !card.teacherPresent
      ? card
      : null;
  });

  constructor() {
    interval(SUMMON_REFRESH_MS)
      .pipe(
        startWith(0),
        // the line only adds a hint: a failed refresh hides it, never a toast
        switchMap(() => this.api.calls(quietContext()).pipe(catchError(() => of(null)))),
        takeUntilDestroyed(),
      )
      .subscribe((calls) => {
        this.calls.set(calls);
      });
  }

  protected line(card: CallCard): string {
    return card.ownerType === 'GROUP'
      ? this.t.groupAbsent(card.members - card.waiting.length, card.members)
      : this.t.absent(this.firstName(card));
  }

  protected waitingLine(card: CallCard): string {
    return card.ownerType === 'GROUP' ? this.t.groupWaiting : this.t.waiting(this.firstName(card));
  }

  protected firstName(card: CallCard): string {
    return card.name.split(' ')[0] ?? card.name;
  }

  protected summon(card: CallCard): void {
    this.busy.guard('', this.api.summon(card.ownerId)).subscribe((recipients) => {
      this.snackbar.success(
        card.ownerType === 'GROUP' ? this.t.sentGroup(recipients) : this.t.sent,
      );
    });
  }
}
