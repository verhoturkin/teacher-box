import { TestBed } from '@angular/core/testing';
import { ExternalNavigation } from './external-navigation';

describe('ExternalNavigation', () => {
  it('knows the origin of the portal', () => {
    expect(TestBed.inject(ExternalNavigation).origin()).toBe(window.location.origin);
  });

  it('leaves the portal', () => {
    const navigation = TestBed.inject(ExternalNavigation);
    const assign = vi.fn();
    vi.stubGlobal('location', { assign });

    navigation.go('https://accounts.google.com/o/oauth2/v2/auth');

    expect(assign).toHaveBeenCalledWith('https://accounts.google.com/o/oauth2/v2/auth');
    vi.unstubAllGlobals();
  });
});
