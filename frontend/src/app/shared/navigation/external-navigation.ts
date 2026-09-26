import { Injectable } from '@angular/core';

/** Leaves the portal for another site (e.g. Google's consent page); a seam for tests. */
@Injectable({ providedIn: 'root' })
export class ExternalNavigation {
  go(url: string): void {
    globalThis.location.assign(url);
  }

  /** Address of the portal as the user opened it, e.g. `https://school.example.com`. */
  origin(): string {
    return window.location.origin;
  }
}
