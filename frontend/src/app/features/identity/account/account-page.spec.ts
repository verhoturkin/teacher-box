import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AuthService } from '@core/auth/auth.service';
import { Role } from '@core/auth/auth.models';
import { authResponse } from '@testing/auth';
import { hostElement, readableText } from '@testing/dom';
import { preferences } from '@testing/notification-fixtures';
import { testProviders } from '@testing/setup';
import { AccountPage } from './account-page';

describe('AccountPage', () => {
  async function render(
    role: Role,
  ): Promise<{ host: HTMLElement; backend: HttpTestingController }> {
    TestBed.configureTestingModule({ imports: [AccountPage], providers: testProviders() });
    TestBed.inject(AuthService).acceptSession(authResponse(role));
    const fixture = TestBed.createComponent(AccountPage);
    await fixture.whenStable();
    const backend = TestBed.inject(HttpTestingController);
    backend.expectOne('/api/me');
    return { host: hostElement(fixture), backend };
  }

  it('puts the title «Мой аккаунт» over the account', async () => {
    const { host, backend } = await render('ADMIN');

    expect(host.querySelector('h1')?.textContent).toContain('Мой аккаунт');
    expect(host.querySelector('tb-account-panel')).not.toBeNull();
    // the administrator has no messengers
    expect(host.querySelector('tb-channels-panel')).toBeNull();
    expect(host.querySelector('tb-preferences-panel')).toBeNull();
    backend.verify();
  });

  it('gives a student the messengers and what to send under the account', async () => {
    const { host, backend } = await render('STUDENT');
    backend.expectOne('/api/me/channels').flush([]);
    backend.expectOne('/api/me/notifications/preferences').flush(preferences());

    expect(
      Array.from(host.querySelectorAll(':scope > .tb-stack > *'), (part) =>
        part.tagName.toLowerCase(),
      ),
    ).toEqual(['tb-account-panel', 'tb-channels-panel', 'tb-preferences-panel']);
    const text = readableText(host);
    expect(text).toContain('Мессенджеры');
    expect(text).toContain('Что присылать в мессенджеры');
    backend.verify();
  });
});
