import { DestroyRef, Injectable, effect, inject, signal } from '@angular/core';

/**
 * What a nested page adds to the title of the tab (WCAG 2.4.2): «Алиса Соловьёва — Проверка работы —
 * Teacher Box». The tabs of several open works are told apart. Set by {@link pageDetail}.
 */
@Injectable({ providedIn: 'root' })
export class PageDetail {
  readonly value = signal<string | null>(null);
}

/**
 * Puts the detail of the page (a name) into the title of the tab while the page lives: call it in
 * the constructor of the page with a function that reads its data.
 */
export function pageDetail(detail: () => string | null | undefined): void {
  const store = inject(PageDetail);
  effect(() => {
    store.value.set(detail() ?? null);
  });
  inject(DestroyRef).onDestroy(() => {
    store.value.set(null);
  });
}
