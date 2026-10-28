import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { filter } from 'rxjs';
import { CORE_T } from '@core/i18n/texts';
import { Snackbar } from '@core/snackbar/snackbar';

/**
 * A new build is downloaded in the background by the service worker (ADR-0051); the user is offered
 * «Обновить» instead of running on the old shell until the tab is closed.
 */
@Injectable({ providedIn: 'root' })
export class AppUpdates {
  private readonly updates = inject(SwUpdate);
  private readonly snackbar = inject(Snackbar);
  private readonly document = inject(DOCUMENT);

  /** Without a service worker (development, an old browser) there is nothing to watch. */
  start(): void {
    if (!this.updates.isEnabled) {
      return;
    }
    this.updates.versionUpdates
      .pipe(filter((event): event is VersionReadyEvent => event.type === 'VERSION_READY'))
      .subscribe(() => {
        this.snackbar.action(CORE_T.update.available, CORE_T.update.apply, () => {
          void this.updates.activateUpdate().then(() => {
            this.document.location.reload();
          });
        });
      });
  }
}
