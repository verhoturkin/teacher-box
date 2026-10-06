import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { AuthService } from '@core/auth/auth.service';
import { authResponse } from '@testing/auth';
import { CallSession } from './call-session';
import { openCallGuard } from './open-call.guard';

@Component({
  selector: 'tb-page',
  template: 'page',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class Page {}

describe('openCallGuard', () => {
  let harness: RouterTestingHarness;
  let open: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    open = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'call/:ownerId', canActivate: [openCallGuard], children: [] },
          { path: 'login', component: Page },
          { path: 'cabinet', component: Page },
          { path: 'admin', component: Page },
          { path: 'teacher/schedule', component: Page },
        ]),
        { provide: CallSession, useValue: { open } },
      ],
    });
    harness = await RouterTestingHarness.create();
  });

  function url(): string {
    return TestBed.inject(Router).url;
  }

  it('sends a guest to sign in and back', async () => {
    await harness.navigateByUrl('/call/g-1');

    expect(url()).toBe('/login?returnUrl=%2Fcall%2Fg-1');
    expect(open).not.toHaveBeenCalled();
  });

  it('opens the call over the start page when the link comes from outside', async () => {
    TestBed.inject(AuthService).acceptSession(authResponse('STUDENT'));

    await harness.navigateByUrl('/call/g-1');

    expect(url()).toBe('/cabinet');
    expect(open).toHaveBeenCalledWith('g-1');
  });

  it('keeps the user on the page inside the portal', async () => {
    TestBed.inject(AuthService).acceptSession(authResponse('TEACHER'));
    await harness.navigateByUrl('/teacher/schedule');

    await harness.navigateByUrl('/call/s-1');

    expect(url()).toBe('/teacher/schedule');
    expect(open).toHaveBeenCalledWith('s-1');
  });

  it('opens nothing for the administrator', async () => {
    TestBed.inject(AuthService).acceptSession(authResponse('ADMIN'));

    await harness.navigateByUrl('/call/g-1');

    expect(url()).toBe('/admin');
    expect(open).not.toHaveBeenCalled();
  });
});
