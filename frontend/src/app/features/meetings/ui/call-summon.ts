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
export const SUMMON_REFRESH_MS = 30_000;

/**
 * «Позвать» (sketch «Сегодня — один урок», boards 1 and 4): while a lesson runs in the portal's room,
 * «<Имя> ещё не в звонке» with a small text button that sends the absent students a notice with the
 * call; a group — «Позвать остальных». Shows nothing while the presence is unknown (calls off, the
 * media server down, an external room) or everyone is in.
 */
@Component({
  selector: 'tb-call-summon',
  imports: [Button],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (absent(); as card) {
      <i class="tb-i tb-i-person_off" aria-hidden="true"></i>
      <span class="tb-call-summon__text">{{ line(card) }}</span>
      <p-button
        [label]="card.ownerType === 'GROUP' ? t.summonRest : t.summon"
        [text]="true"
        styleClass="tb-button-xs"
        [loading]="busy.is()"
        (onClick)="summon(card)"
      />
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
  `,
})
export class CallSummon {
  protected readonly t = T.summon;
  private readonly api = inject(MeetingsApi);
  private readonly snackbar = inject(Snackbar);
  protected readonly busy = new Busy();

  /** The student or the group of the running lesson. */
  readonly ownerId = input.required<string>();

  private readonly calls = signal<CallsOverview | null>(null);
  /** The room while somebody of it is not in the call and the presence is known. */
  protected readonly absent = computed(() => {
    const calls = this.calls();
    const card = calls?.rooms.find((room) => room.ownerId === this.ownerId());
    return calls?.status === 'OK' &&
      card !== undefined &&
      !card.externalLink &&
      card.waiting.length < card.members
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
      : this.t.absent(card.name.split(' ')[0] ?? card.name);
  }

  protected summon(card: CallCard): void {
    this.busy.guard('', this.api.summon(card.ownerId)).subscribe((recipients) => {
      this.snackbar.success(
        card.ownerType === 'GROUP' ? this.t.sentGroup(recipients) : this.t.sent,
      );
    });
  }
}
