import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { testProviders } from '@testing/setup';
import { openOnCreate } from './create-param';

const opened: string[] = [];

@Component({
  selector: 'tb-create-host',
  template: '',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class Host {
  constructor() {
    openOnCreate('payment', () => opened.push('payment'));
  }
}

@Component({
  selector: 'tb-create-leaving-host',
  template: '',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class LeavingHost {
  constructor() {
    openOnCreate('assignment', () => opened.push('assignment'), false);
  }
}

describe('openOnCreate', () => {
  let router: Router;

  beforeEach(() => {
    opened.length = 0;
    TestBed.configureTestingModule({ providers: testProviders() });
    router = TestBed.inject(Router);
  });

  it('opens the form for its kind on arrival and drops the parameter', async () => {
    await router.navigateByUrl('/?view=week&create=payment');
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();

    expect(opened).toEqual(['payment']);
    expect(router.url).toBe('/?view=week');
  });

  it('opens it again when the parameter comes to the open page, not for another kind', async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    expect(opened).toEqual([]);

    await router.navigateByUrl('/?create=lesson');
    await fixture.whenStable();
    expect(opened).toEqual([]);
    expect(router.url).toBe('/?create=lesson');

    await router.navigateByUrl('/?create=payment');
    await fixture.whenStable();
    await router.navigateByUrl('/?create=payment');
    await fixture.whenStable();
    expect(opened).toEqual(['payment', 'payment']);
  });

  it('keeps the address when the form leaves the page itself', async () => {
    await router.navigateByUrl('/?create=assignment');
    const fixture = TestBed.createComponent(LeavingHost);
    await fixture.whenStable();

    expect(opened).toEqual(['assignment']);
    expect(router.url).toBe('/?create=assignment');
  });

  it('stops listening with the page', async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    fixture.destroy();

    await router.navigateByUrl('/?create=payment');
    expect(opened).toEqual([]);
  });
});
