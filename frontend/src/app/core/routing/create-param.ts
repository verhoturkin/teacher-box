import { DestroyRef, afterNextRender, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';

/**
 * What «Создать» in the rail makes on a section's page (spec §4): each kind has one home, the form of its
 * section (a message to students opens over any page, `create-menu.ts`).
 */
export type CreateKind = 'lesson' | 'assignment' | 'payment' | 'student' | 'board';

/** The query parameter that asks a section for the form of a new item: `?create=<kind>`. */
export const CREATE_PARAM = 'create';

/**
 * Opens the form of a new item when the address asks for it (`?create=<kind>` from «Создать» in the rail,
 * spec §4) — on arrival and when the parameter comes to the page already open — and drops the parameter
 * (replacing the address), so a reload or «Назад» does not open the form again and the same item can be
 * chosen once more. Call it in an injection context of a routed page or of a part of it. It waits for the
 * first render: the navigation that brought the page is over by then. `drop: false` — `open` leaves the
 * page itself (a route of its own, with `replaceUrl`).
 */
export function openOnCreate(kind: CreateKind, open: () => void, drop = true): void {
  const route = inject(ActivatedRoute);
  const router = inject(Router);
  const destroyRef = inject(DestroyRef);
  afterNextRender(() => {
    route.queryParamMap.pipe(takeUntilDestroyed(destroyRef)).subscribe((params) => {
      if (params.get(CREATE_PARAM) !== kind) {
        return;
      }
      open();
      if (drop) {
        void router.navigate([], {
          relativeTo: route,
          queryParams: { [CREATE_PARAM]: null },
          queryParamsHandling: 'merge',
          replaceUrl: true,
        });
      }
    });
  });
}
