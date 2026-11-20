import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { AuthService } from '@core/auth/auth.service';
import { authResponse } from '@testing/auth';
import { CHILD_ID, SECOND_CHILD_ID, familyChild, pendingRequest } from '@testing/family-fixtures';
import { testProvidersWithRouter } from '@testing/setup';
import { Family } from './family';
import { familyChildGuard, firstChildGuard } from './family.guards';

@Component({ template: '', changeDetection: ChangeDetectionStrategy.OnPush })
class Blank {}

describe('family guards', () => {
  let backend: HttpTestingController;
  let router: Router;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: testProvidersWithRouter(
        provideRouter([
          { path: 'family', pathMatch: 'full', canActivate: [firstChildGuard], component: Blank },
          { path: 'family/:studentId', canActivate: [familyChildGuard], component: Blank },
        ]),
      ),
    });
    TestBed.inject(AuthService).acceptSession(authResponse('GUARDIAN'));
    backend = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
  });

  afterEach(() => {
    backend.verify();
  });

  async function navigate(url: string, children = [familyChild()]): Promise<string> {
    const done = router.navigateByUrl(url);
    (await pendingRequest(backend, '/api/guardian/children')).flush(children);
    await done;
    return router.url;
  }

  it('leads /family to the first child', async () => {
    expect(await navigate('/family', [familyChild(), familyChild({ id: SECOND_CHILD_ID })])).toBe(
      `/family/${CHILD_ID}`,
    );
    expect(TestBed.inject(Family).current()).toBe(CHILD_ID);
  });

  it('keeps the query on the way to the first child', async () => {
    expect(await navigate('/family?notifications=inbox')).toBe(
      `/family/${CHILD_ID}?notifications=inbox`,
    );
  });

  it('keeps /family without a child: the page says so', async () => {
    expect(await navigate('/family', [])).toBe('/family');
  });

  it('opens a child of the parent and makes them current', async () => {
    const family = TestBed.inject(Family);
    expect(
      await navigate(`/family/${SECOND_CHILD_ID}`, [
        familyChild(),
        familyChild({ id: SECOND_CHILD_ID }),
      ]),
    ).toBe(`/family/${SECOND_CHILD_ID}`);
    expect(family.current()).toBe(SECOND_CHILD_ID);
  });

  it('leads another student to the first child', async () => {
    expect(await navigate('/family/someone-else')).toBe(`/family/${CHILD_ID}`);
  });
});
