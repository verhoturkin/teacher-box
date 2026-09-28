import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { AuthService } from '@core/auth/auth.service';
import { authResponse } from '@testing/auth';
import { portalSettings } from '@testing/portal-fixtures';
import { Portal, PortalSettings } from './portal';
import { setupGuard } from './setup.guard';

@Component({ selector: 'tb-empty', template: '', changeDetection: ChangeDetectionStrategy.OnPush })
class Empty {}

describe('setupGuard', () => {
  let backend: HttpTestingController;
  let router: Router;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([
          {
            path: 'teacher',
            canActivateChild: [setupGuard],
            children: [
              { path: '', component: Empty },
              { path: 'setup', component: Empty },
              { path: 'students', component: Empty },
            ],
          },
        ]),
      ],
    });
    backend = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    TestBed.inject(AuthService).acceptSession(authResponse('TEACHER'));
  });

  afterEach(() => {
    backend.verify();
  });

  /** Opens the page and answers the question about the setup, if the guard asks it. */
  async function open(url: string, settings?: PortalSettings | 'error'): Promise<string> {
    const navigation = router.navigateByUrl(url);
    if (settings !== undefined) {
      await vi.waitFor(() => {
        const request = backend.expectOne('/api/teacher/portal');
        if (settings === 'error') {
          request.flush(null, { status: 500, statusText: 'Error' });
        } else {
          request.flush(settings);
        }
      });
    }
    await navigation;
    return router.url;
  }

  it('leads the home page to the wizard until the setup is done', async () => {
    expect(await open('/teacher', portalSettings({ setupCompleted: false }))).toBe(
      '/teacher/setup',
    );
    expect(await open('/teacher', portalSettings({ setupCompleted: true }))).toBe('/teacher');
    await open('/teacher/students');
    expect(await open('/teacher')).toBe('/teacher');
  });

  it('asks nothing on other pages and lets the teacher in when the server does not answer', async () => {
    expect(await open('/teacher/students')).toBe('/teacher/students');
    expect(await open('/teacher/setup')).toBe('/teacher/setup');
    expect(await open('/teacher', 'error')).toBe('/teacher');
  });

  it('asks for a new password before anything else', async () => {
    const response = authResponse('TEACHER');
    TestBed.inject(AuthService).acceptSession({
      ...response,
      user: { ...response.user, passwordChangeRequired: true },
    });

    expect(await open('/teacher/students')).toBe('/teacher/setup');
  });

  it('forgets the finished setup after a reset', async () => {
    const portal = TestBed.inject(Portal);
    portal.setSetupCompleted(true);
    expect(await open('/teacher')).toBe('/teacher');
    await open('/teacher/students');

    portal.setSetupCompleted(false);
    expect(await open('/teacher', portalSettings({ setupCompleted: false }))).toBe(
      '/teacher/setup',
    );
  });
});
