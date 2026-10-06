import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { quietContext } from '@core/http/api-error.interceptor';
import { LoadState } from '@shared/ui/load-state';
import { LoadStateView } from '@shared/ui/load-state-view';
import { CallSession } from '../call/call-session';
import { MeetingsApi } from '../data-access/meetings-api';
import { MyCall } from '../data-access/meetings.models';

/** How often the card asks whether the teacher came in. */
export const MY_CALLS_REFRESH_MS = 30_000;

/**
 * A student's built-in rooms (ADR-0030): their own and their groups', «Учитель уже в звонке» and «Войти».
 * Hidden while calls are off; a failed load shows the card with «Повторить» (ADR-0025).
 */
@Component({
  selector: 'tb-my-calls-card',
  imports: [Button, Card, LoadStateView],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (state.status() === 'error') {
      <p-card header="Видеозвонок">
        <tb-load-state [state]="state" what="звонки" [compact]="true" (retry)="load()" />
      </p-card>
    } @else if (calls().length > 0) {
      <p-card header="Видеозвонок">
        <ul class="tb-list">
          @for (call of calls(); track call.ownerId) {
            <li>
              <span class="tb-list__lead" aria-hidden="true"><i class="pi pi-video"></i></span>
              <div class="tb-list__text">
                <span class="tb-list__title">{{ call.title }}</span>
                <span class="tb-list__supporting">{{
                  call.teacherPresent ? 'Учитель уже в звонке' : 'Учитель пока не в звонке'
                }}</span>
              </div>
              <span class="tb-list__trail">
                <p-button
                  label="Войти"
                  icon="pi pi-video"
                  [severity]="call.teacherPresent ? 'primary' : 'secondary'"
                  [loading]="session.opening() === call.ownerId"
                  [ariaLabel]="'Войти в звонок: ' + call.title"
                  (onClick)="session.open(call.ownerId)"
                />
              </span>
            </li>
          }
        </ul>
      </p-card>
    }
  `,
})
export class MyCallsCard implements OnInit {
  private readonly api = inject(MeetingsApi);
  protected readonly session = inject(CallSession);

  protected readonly calls = signal<MyCall[]>([]);
  protected readonly state = new LoadState();

  constructor() {
    const timer = setInterval(() => {
      this.refresh();
    }, MY_CALLS_REFRESH_MS);
    inject(DestroyRef).onDestroy(() => {
      clearInterval(timer);
    });
  }

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.api
      .myCalls(quietContext())
      .pipe(this.state.track())
      .subscribe((calls) => {
        this.calls.set(calls);
      });
  }

  /** A quiet refresh: a failure keeps what is shown. */
  private refresh(): void {
    this.api.myCalls(quietContext()).subscribe({
      next: (calls) => {
        this.calls.set(calls);
      },
      error: () => undefined,
    });
  }
}
