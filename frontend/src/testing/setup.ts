import { BreakpointObserver } from '@angular/cdk/layout';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { EnvironmentProviders, Provider } from '@angular/core';
import { provideRouter } from '@angular/router';
import { MessageService } from 'primeng/api';
import { providePrimeNG } from 'primeng/config';
import { of } from 'rxjs';

type TestProvider = Provider | EnvironmentProviders;

/**
 * What most component and service tests need: HTTP with `HttpTestingController`, an empty router,
 * PrimeNG and toasts; `extra` adds the test's own providers.
 */
export function testProviders(...extra: TestProvider[]): TestProvider[] {
  return testProvidersWithRouter(provideRouter([]), ...extra);
}

/** The same with the test's own router (`provideRouter(routes, ...)`). */
export function testProvidersWithRouter(
  router: EnvironmentProviders,
  ...extra: TestProvider[]
): TestProvider[] {
  return [
    provideHttpClient(),
    provideHttpClientTesting(),
    router,
    providePrimeNG(),
    MessageService,
    ...extra,
  ];
}

/** A phone's screen (`injectMobile()` is true): the bottom navigation, cards, the day list. */
export function phoneScreen(): Provider {
  return {
    provide: BreakpointObserver,
    useValue: { observe: () => of({ matches: true, breakpoints: {} }) },
  };
}

/** One bound of a media query in px: `width < 37.5em`, `52.5em <= width`, `width >= 100em`. */
function bound(width: number, condition: string): boolean {
  const left = /^([\d.]+)em (<=?) width$/.exec(condition);
  if (left) {
    const px = Number(left[1]) * 16;
    return left[2] === '<' ? px < width : px <= width;
  }
  const right = /^width (<=?|>=?) ([\d.]+)em$/.exec(condition);
  if (!right) {
    return false;
  }
  const px = Number(right[2]) * 16;
  switch (right[1]) {
    case '<':
      return width < px;
    case '<=':
      return width <= px;
    case '>':
      return width > px;
    default:
      return width >= px;
  }
}

/** Whether a width query (`(37.5em <= width < 52.5em)`, `(width >= 100em)`) holds at `width` px and 16 px em. */
function matchesWidth(query: string, width: number): boolean {
  const range = /^\(([\d.]+em <=? )?width( [<>]=? [\d.]+em)?\)$/.exec(query);
  if (!range || (!range[1] && !range[2])) {
    return false;
  }
  const from = range[1] ? bound(width, `${range[1]}width`) : true;
  const to = range[2] ? bound(width, `width${range[2]}`) : true;
  return from && to;
}

/** A window `width` px wide at the usual font (16 px em): every width query is answered for it (ADR-0048). */
export function screenWidth(width: number): Provider {
  return {
    provide: BreakpointObserver,
    useValue: {
      observe: (query: string) => of({ matches: matchesWidth(query, width), breakpoints: {} }),
    },
  };
}
