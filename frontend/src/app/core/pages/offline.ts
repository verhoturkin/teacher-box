import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { ButtonDirective, ButtonIcon, ButtonLabel } from 'primeng/button';
import { Card } from 'primeng/card';
import { EmptyState } from '@shared/ui/empty-state';
import { PageHeader } from '@shared/ui/page-header';
import { CORE_T } from '@core/i18n/texts';
import { Snackbar } from '@core/snackbar/snackbar';

/**
 * «Нет связи»: the installed app (service worker, 312.1) starts without the network, the shell is
 * there but the data is not (personal data is never cached). Outside the frame: it needs no session.
 */
@Component({
  selector: 'tb-offline-page',
  imports: [ButtonDirective, ButtonIcon, ButtonLabel, Card, EmptyState, PageHeader],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="tb-offline-page">
      <tb-page-header [title]="t.title" />
      <p-card>
        <tb-empty-state icon="tb-i-cloud-off" [title]="t.empty" [hint]="t.hint">
          <button pButton type="button" (click)="retry()">
            <i pButtonIcon aria-hidden="true" class="tb-i tb-i-refresh"></i>
            <span pButtonLabel>{{ t.retry }}</span>
          </button>
        </tb-empty-state>
      </p-card>
    </main>
  `,
  styles: `
    .tb-offline-page {
      box-sizing: border-box;
      max-width: var(--tb-content-narrow);
      margin: 0 auto;
      padding: var(--tb-space-8) var(--tb-space-4);
    }
  `,
})
export class OfflinePage {
  private readonly router = inject(Router);
  private readonly snackbar = inject(Snackbar);
  protected readonly t = CORE_T.offline;

  protected retry(): void {
    if (navigator.onLine) {
      void this.router.navigateByUrl('/');
    } else {
      this.snackbar.info(this.t.empty);
    }
  }
}
