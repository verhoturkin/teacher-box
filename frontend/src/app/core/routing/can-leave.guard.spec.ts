import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { CanLeave, canLeaveGuard } from './can-leave.guard';

@Component({ template: '', changeDetection: ChangeDetectionStrategy.OnPush })
class Page implements CanLeave {
  static leave = true;

  canLeave(): Promise<boolean> {
    return Promise.resolve(Page.leave);
  }
}

describe('canLeaveGuard', () => {
  it('lets the user go only when the page agrees', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'board', component: Page, canDeactivate: [canLeaveGuard] },
          { path: 'list', component: Page },
        ]),
      ],
    });
    const harness = await RouterTestingHarness.create('/board');
    const router = TestBed.inject(Router);

    Page.leave = false;
    await harness.navigateByUrl('/list');
    expect(router.url).toBe('/board');

    Page.leave = true;
    await harness.navigateByUrl('/list');
    expect(router.url).toBe('/list');
  });
});
