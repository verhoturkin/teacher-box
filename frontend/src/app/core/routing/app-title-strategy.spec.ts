import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { TitleStrategy, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { DEFAULT_PORTAL_NAME, Portal } from '@core/portal/portal';
import { AppTitleStrategy } from './app-title-strategy';

@Component({ selector: 'tb-empty', template: '', changeDetection: ChangeDetectionStrategy.OnPush })
class Empty {}

describe('AppTitleStrategy', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([
          { path: 'titled', title: 'Оплаты', component: Empty },
          { path: 'untitled', component: Empty },
        ]),
        { provide: TitleStrategy, useClass: AppTitleStrategy },
      ],
    });
  });

  it('appends the portal name to the route title', async () => {
    const harness = await RouterTestingHarness.create();

    await harness.navigateByUrl('/titled');

    expect(TestBed.inject(Title).getTitle()).toBe('Оплаты — Teacher Box');
  });

  it('uses the portal name for routes without title', async () => {
    const harness = await RouterTestingHarness.create();

    await harness.navigateByUrl('/untitled');

    expect(TestBed.inject(Title).getTitle()).toBe(DEFAULT_PORTAL_NAME);
  });

  it('follows a renamed portal', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/titled');

    TestBed.inject(Portal).set({ name: 'Английский с Марией', address: null });
    TestBed.tick();

    expect(TestBed.inject(Title).getTitle()).toBe('Оплаты — Английский с Марией');
  });
});
