import { TestBed } from '@angular/core/testing';
import { hostElement } from '@testing/dom';
import { portalInfo } from '@testing/portal-fixtures';
import { testProviders } from '@testing/setup';
import { Portal } from './portal';
import { PortalLogo } from './portal-logo';

describe('PortalLogo', () => {
  function render(logo: string | null, round: boolean): HTMLElement {
    TestBed.configureTestingModule({ imports: [PortalLogo], providers: testProviders() });
    TestBed.inject(Portal).set(portalInfo({ logo }));
    const fixture = TestBed.createComponent(PortalLogo);
    fixture.componentRef.setInput('size', '2rem');
    fixture.componentRef.setInput('round', round);
    fixture.detectChanges();
    return hostElement(fixture);
  }

  it('cuts the logo to a circle of its size in the top bar', () => {
    const image = render('/api/public/portal/logo?v=1', true).querySelector('img');

    expect(image?.classList).toContain('tb-portal-logo--round');
    expect(image?.style.width).toBe('2rem');
    expect(image?.style.height).toBe('2rem');
  });

  it('keeps the shape of the logo elsewhere', () => {
    const image = render('/api/public/portal/logo?v=1', false).querySelector('img');

    expect(image?.classList).not.toContain('tb-portal-logo--round');
    expect(image?.style.width).toBe('');
  });

  it('shows the default icon without a logo', () => {
    expect(render(null, true).querySelector('.pi-graduation-cap')).not.toBeNull();
  });
});
