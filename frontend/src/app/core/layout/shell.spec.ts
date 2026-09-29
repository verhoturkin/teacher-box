import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { AuthService } from '@core/auth/auth.service';
import { Portal } from '@core/portal/portal';
import { ThemeMode } from '@core/theme/theme-mode';
import { authResponse } from '@testing/auth';
import { bodyText, buttonByText, hostElement } from '@testing/dom';
import { Shell } from './shell';
import { tabletScreen, testProviders } from '@testing/setup';
import { portalInfo } from '@testing/portal-fixtures';

describe('Shell', () => {
  let fixture: ComponentFixture<Shell>;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [Shell],
      providers: testProviders(),
    });
    TestBed.inject(AuthService).acceptSession(authResponse('TEACHER'));
    vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    fixture = TestBed.createComponent(Shell);
    fixture.componentRef.setInput('items', [{ label: 'Ученики', routerLink: '/teacher/students' }]);
    fixture.componentRef.setInput('homeLink', '/teacher');
    fixture.componentRef.setInput('userLinks', [
      { label: 'Настройки', routerLink: '/teacher/settings' },
    ]);
    await fixture.whenStable();
  });

  afterEach(() => {
    fixture.destroy();
  });

  it('shows the name of the portal', async () => {
    TestBed.inject(Portal).set(portalInfo({ name: 'Английский с Марией', address: null }));
    await fixture.whenStable();

    expect(hostElement(fixture).querySelector('.tb-shell__brand')?.textContent).toContain(
      'Английский с Марией',
    );
  });

  it('shows the navigation and the user, but not the name of the area (ADR-0019)', () => {
    const text = hostElement(fixture).textContent;
    expect(text).toContain('Teacher Box');
    expect(text).toContain('Ученики');
    expect(text).toContain('Анна Сергеевна');
    expect(text).not.toContain('Кабинет учителя');
  });

  it('puts the sections in the expanded rail on a wide screen', () => {
    const nav = hostElement(fixture).querySelector('tb-side-nav');
    expect(nav?.classList).not.toContain('tb-side-nav--rail');
    expect(nav?.textContent).toContain('Ученики');
    expect(hostElement(fixture).querySelector('nav.tb-bottom-nav')).toBeNull();
  });

  it('has no notification bell for the administrator', async () => {
    expect(hostElement(fixture).querySelector('tb-notification-bell')).not.toBeNull();

    fixture.componentRef.setInput('notifications', false);
    await fixture.whenStable();

    expect(hostElement(fixture).querySelector('tb-notification-bell')).toBeNull();
  });

  it('switches the theme from the user menu', async () => {
    buttonByText(hostElement(fixture), 'Меню пользователя').click();
    await fixture.whenStable();

    const dark = Array.from(document.body.querySelectorAll('a')).find((element) =>
      element.textContent.includes('Тёмная тема'),
    );
    dark?.click();

    expect(TestBed.inject(ThemeMode).choice()).toBe('dark');
    TestBed.inject(ThemeMode).choose('system');
    localStorage.clear();
  });

  it('signs out from the user menu', async () => {
    buttonByText(hostElement(fixture), 'Меню пользователя').click();
    await fixture.whenStable();
    expect(bodyText()).toContain('Настройки');
    expect(bodyText()).toContain('Мой аккаунт');

    const logout = Array.from(document.body.querySelectorAll('a')).find((element) =>
      element.textContent.includes('Выйти'),
    );
    if (logout === undefined) {
      throw new Error('Logout item not found');
    }
    logout.click();
    TestBed.inject(HttpTestingController).expectOne('/api/auth/logout').flush(null);

    expect(TestBed.inject(AuthService).isAuthenticated()).toBe(false);
  });
});

describe('Shell on a tablet', () => {
  it('puts the sections in the rail', async () => {
    TestBed.configureTestingModule({
      imports: [Shell],
      providers: testProviders(tabletScreen()),
    });
    TestBed.inject(AuthService).acceptSession(authResponse('TEACHER'));
    const fixture = TestBed.createComponent(Shell);
    fixture.componentRef.setInput('items', [{ label: 'Ученики', routerLink: '/teacher/students' }]);
    fixture.componentRef.setInput('homeLink', '/teacher');
    await fixture.whenStable();

    const host = hostElement(fixture);
    expect(host.querySelector('tb-side-nav')?.classList).toContain('tb-side-nav--rail');
    expect(host.querySelector('nav.tb-bottom-nav')).toBeNull();
    expect(host.querySelector('button[aria-label="Меню пользователя"]')?.textContent).toContain(
      'Анна',
    );
    fixture.destroy();
  });
});
