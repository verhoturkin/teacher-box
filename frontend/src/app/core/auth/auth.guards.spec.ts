import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { authResponse } from '@testing/auth';
import { guestGuard, redirectToHome, roleGuard } from './auth.guards';
import { AuthService } from './auth.service';

@Component({ selector: 'tb-page', template: 'page', changeDetection: ChangeDetectionStrategy.OnPush })
class Page {}

describe('auth guards', () => {
  let harness: RouterTestingHarness;
  let auth: AuthService;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: '', pathMatch: 'full', redirectTo: redirectToHome },
          { path: 'login', canActivate: [guestGuard], component: Page },
          { path: 'teacher', canActivate: [roleGuard('TEACHER')], component: Page },
          { path: 'cabinet', canActivate: [roleGuard('STUDENT')], component: Page },
        ]),
      ],
    });
    auth = TestBed.inject(AuthService);
    harness = await RouterTestingHarness.create();
  });

  function url(): string {
    return TestBed.inject(Router).url;
  }

  it('sends anonymous users to sign-in with a return url', async () => {
    await harness.navigateByUrl('/teacher');

    expect(url()).toBe('/login?returnUrl=%2Fteacher');
  });

  it('lets users with the right role in', async () => {
    auth.acceptSession(authResponse('TEACHER'));

    await harness.navigateByUrl('/teacher');

    expect(url()).toBe('/teacher');
  });

  it('redirects users of another role to their own area', async () => {
    auth.acceptSession(authResponse('STUDENT'));

    await harness.navigateByUrl('/teacher');

    expect(url()).toBe('/cabinet');
  });

  it('keeps signed-in users away from the sign-in page', async () => {
    auth.acceptSession(authResponse('TEACHER'));

    await harness.navigateByUrl('/login');

    expect(url()).toBe('/teacher');
  });

  it('shows the sign-in page to anonymous users', async () => {
    await harness.navigateByUrl('/login');

    expect(url()).toBe('/login');
  });

  it('redirects the root by role', async () => {
    await harness.navigateByUrl('/');
    expect(url()).toBe('/login');

    auth.acceptSession(authResponse('STUDENT'));
    await harness.navigateByUrl('/');
    expect(url()).toBe('/cabinet');
  });
});
