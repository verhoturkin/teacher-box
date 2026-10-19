import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { hostElement } from '@testing/dom';
import { testProviders } from '@testing/setup';
import { AccountPage } from './account-page';

describe('AccountPage', () => {
  it('puts the title «Мой аккаунт» over the account', async () => {
    TestBed.configureTestingModule({ imports: [AccountPage], providers: testProviders() });
    const fixture = TestBed.createComponent(AccountPage);
    await fixture.whenStable();
    TestBed.inject(HttpTestingController).expectOne('/api/me');

    const host = hostElement(fixture);
    expect(host.querySelector('h1')?.textContent).toContain('Мой аккаунт');
    expect(host.querySelector('tb-account-panel')).not.toBeNull();
  });
});
