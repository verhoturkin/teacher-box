import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { EmptyState } from '@shared/ui/empty-state';
import { LoadState } from '@shared/ui/load-state';
import { LoadStateView } from '@shared/ui/load-state-view';
import { LoadingIndicator } from '@shared/ui/loading-indicator';

/** A state that has already settled, as `LoadState.track()` leaves it after an answer. */
function settled(failure: HttpErrorResponse | null): LoadState {
  const state = new LoadState();
  if (failure === null) state.done();
  else state.fail(failure);
  return state;
}

/**
 * §12 The three states of a section that loads: `LoadState` + `tb-load-state` — the M3E loading indicator,
 * the error with its code and «Retry», the content (here the empty state, shown only after an answer).
 */
@Component({
  selector: 'tb-gallery-load-state',
  imports: [EmptyState, LoadStateView, LoadingIndicator],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ul class="tb-gallery-grid">
      <li class="tb-gallery-cell">
        <tb-loading-indicator />
        <code class="tb-gallery-name"
          >Seven Material shapes · 200 ms delay · system reduced motion</code
        >
      </li>
      <li class="tb-gallery-cell">
        <tb-load-state [state]="loading" />
        <code class="tb-gallery-name">new LoadState() — loading</code>
      </li>
      <li class="tb-gallery-cell">
        <tb-load-state [state]="failed" [compact]="true" (retry)="retried = retried + 1" />
        <code class="tb-gallery-name">state.fail(error) — the error, (retry)</code>
      </li>
      <li class="tb-gallery-cell">
        <tb-load-state [state]="ready">
          <tb-empty-state
            icon="tb-i-group"
            title="No students yet"
            hint="Invite a student to see them here"
          />
        </tb-load-state>
        <code class="tb-gallery-name">state.done() — the content</code>
      </li>
    </ul>
  `,
})
export class LoadStateSample {
  protected readonly loading = new LoadState();
  protected readonly failed = settled(
    new HttpErrorResponse({ status: 503, statusText: 'Service Unavailable' }),
  );
  protected readonly ready = settled(null);
  protected retried = 0;
}
