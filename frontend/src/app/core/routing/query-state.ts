import { ActivatedRoute, Router } from '@angular/router';

/**
 * Keeps the state of a list page (month, filter, search) in the address: a query parameter per value,
 * written with `replaceUrl`, so typing does not fill the history, while «Назад» (to the page from a card)
 * and a reload bring the same list back. `null` or an empty value drops the parameter.
 */
export function writeQuery(
  router: Router,
  route: ActivatedRoute,
  params: Readonly<Record<string, string | null>>,
): void {
  const queryParams: Record<string, string | null> = {};
  for (const [key, value] of Object.entries(params)) {
    queryParams[key] = value === null || value === '' ? null : value;
  }
  void router.navigate([], {
    relativeTo: route,
    queryParams,
    queryParamsHandling: 'merge',
    replaceUrl: true,
  });
}

/** A query parameter taken once on arrival, or the fallback when it is missing or not among `allowed`. */
export function readQuery<T extends string>(
  route: ActivatedRoute,
  key: string,
  allowed: readonly T[],
): T | null {
  const value = route.snapshot.queryParamMap.get(key);
  return allowed.find((item) => item === value) ?? null;
}
