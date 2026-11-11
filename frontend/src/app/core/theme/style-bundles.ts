import { DOCUMENT, Injectable, inject } from '@angular/core';
import { CanActivateFn } from '@angular/router';

/** The calendar's styles: FullCalendar's skeleton and theme with `features/schedule/ui/schedule-calendar.scss`. */
export const CALENDAR_STYLESHEET = 'calendar.css';

/**
 * Style bundles loaded on demand by name (angular.json `inject: false`): the styles of one heavy screen
 * that a component stylesheet cannot carry (third-party CSS, the `anyComponentStyle` budget). The file
 * names are not hashed, so nginx serves them with `no-cache`.
 */
@Injectable({ providedIn: 'root' })
export class StyleBundles {
  private readonly document = inject(DOCUMENT);
  private readonly loading = new Map<string, Promise<void>>();

  /** Adds the stylesheet once per page life and waits for it; a failed load is retried on the next call. */
  load(href: string): Promise<void> {
    let loading = this.loading.get(href);
    if (loading === undefined) {
      loading = this.append(href).catch((error: unknown) => {
        this.loading.delete(href);
        throw error;
      });
      this.loading.set(href, loading);
    }
    return loading;
  }

  private append(href: string): Promise<void> {
    const link = this.document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    const loaded = new Promise<void>((resolve, reject) => {
      link.addEventListener('load', () => {
        resolve();
      });
      link.addEventListener('error', () => {
        link.remove();
        reject(new Error(`${href} did not load`));
      });
    });
    this.document.head.append(link);
    return loaded;
  }
}

/**
 * Opens a route once its style bundle is there, so the screen never shows unstyled. A bundle that did not
 * load does not close the route: the next visit asks for it again.
 */
export function withStyleBundle(href: string): CanActivateFn {
  return () =>
    inject(StyleBundles)
      .load(href)
      .then(
        () => true,
        () => true,
      );
}
