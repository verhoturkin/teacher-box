import { HttpTestingController } from '@angular/common/http/testing';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { AuthService } from '@core/auth/auth.service';
import { authResponse } from '@testing/auth';
import { pendingRequest } from '@testing/family-fixtures';
import { testProvidersWithRouter } from '@testing/setup';
import { PaymentsVisibility, paymentsVisibleGuard } from './payments-visibility';

@Component({ template: '', changeDetection: ChangeDetectionStrategy.OnPush })
class Blank {}

describe('PaymentsVisibility', () => {
  let backend: HttpTestingController;
  let visibility: PaymentsVisibility;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: testProvidersWithRouter(
        provideRouter([
          { path: 'cabinet', component: Blank },
          { path: 'cabinet/billing', canActivate: [paymentsVisibleGuard], component: Blank },
        ]),
      ),
    });
    TestBed.inject(AuthService).acceptSession(authResponse('STUDENT'));
    backend = TestBed.inject(HttpTestingController);
    visibility = TestBed.inject(PaymentsVisibility);
  });

  afterEach(() => {
    backend.verify();
  });

  it('shows the payments until the server says otherwise, and asks once per sign-in', () => {
    expect(visibility.visible()).toBe(true);
    visibility.load().subscribe();
    backend.expectOne('/api/me/billing/visible').flush({ visible: false });
    expect(visibility.visible()).toBe(false);
    visibility.load().subscribe();
    backend.expectNone('/api/me/billing/visible');

    TestBed.inject(AuthService).acceptSession({
      ...authResponse('STUDENT'),
      user: { ...authResponse('STUDENT').user, id: 'other' },
    });
    expect(visibility.visible()).toBe(true);
  });

  it('keeps «Оплаты» when the question fails', () => {
    let answer: boolean | null = null;
    visibility.load().subscribe((visible) => (answer = visible));
    backend
      .expectOne('/api/me/billing/visible')
      .flush(null, { status: 500, statusText: 'Server Error' });
    expect(answer).toBe(true);
    expect(visibility.visible()).toBe(true);
  });

  it.each([
    [true, '/cabinet/billing'],
    [false, '/cabinet'],
  ])('opens /cabinet/billing when visible is %s → %s', async (visible, url) => {
    const router = TestBed.inject(Router);
    const done = router.navigateByUrl('/cabinet/billing');
    (await pendingRequest(backend, '/api/me/billing/visible')).flush({ visible });
    await done;
    expect(router.url).toBe(url);
  });
});
