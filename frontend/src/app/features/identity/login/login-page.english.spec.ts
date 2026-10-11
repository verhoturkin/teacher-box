import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { LANGUAGE_KEY, forgetLanguage } from '@core/i18n/language';
import { buttonByText, hostElement, readableText } from '@testing/dom';
import { testProviders } from '@testing/setup';
import { LoginPage } from './login-page';

describe('LoginPage in English', () => {
  beforeAll(() => {
    localStorage.setItem(LANGUAGE_KEY, 'en');
    forgetLanguage();
  });

  afterAll(() => {
    localStorage.removeItem(LANGUAGE_KEY);
    forgetLanguage();
  });

  it('speaks the chosen language and offers the others', async () => {
    TestBed.configureTestingModule({ imports: [LoginPage], providers: testProviders() });
    vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    const fixture = TestBed.createComponent(LoginPage);
    await fixture.whenStable();
    const host = hostElement(fixture);

    expect(readableText(host)).toContain('Sign in to Teacher Box');
    expect(readableText(host)).toContain('Login Password');
    expect(buttonByText(host, 'English').getAttribute('aria-pressed')).toBe('true');

    buttonByText(host, 'Sign in').click();
    await fixture.whenStable();
    expect(readableText(host)).toContain('Enter the login and the password');
    TestBed.inject(HttpTestingController).verify();
  });
});
