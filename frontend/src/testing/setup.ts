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
