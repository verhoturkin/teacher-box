import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { AuthService } from '@core/auth/auth.service';
import { Portal } from '@core/portal/portal';
import { ThemeMode } from '@core/theme/theme-mode';
import { LANGUAGE_KEY, forgetLanguage, pageReload } from '@core/i18n/language';
import { authResponse } from '@testing/auth';
import { bodyText, hostElement, requireElement } from '@testing/dom';
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

  it('shows a student photo on the user button instead of the person icon', async () => {
    const button = () => hostElement(fixture).querySelector('.tb-shell__user-button');
    expect(button()?.querySelector('.pi-user')).not.toBeNull();

    TestBed.inject(AuthService).profileChanged({
      displayName: 'Ника',
      avatar: '/api/public/avatars/a',
    });
    await fixture.whenStable();

    expect(button()?.querySelector('.pi-user')).toBeNull();
    expect(button()?.querySelector('tb-avatar img')?.getAttribute('src')).toBe(
      '/api/public/avatars/a',
    );
    expect(button()?.textContent).toContain('Ника');
  });

  it('puts the sections in the expanded rail on a wide screen', () => {
    const nav = hostElement(fixture).querySelector('tb-side-nav');
    expect(nav?.classList).not.toContain('tb-side-nav--rail');
    expect(nav?.textContent).toContain('Ученики');
    expect(hostElement(fixture).querySelector('nav.tb-bottom-nav')).toBeNull();
  });

  it('keeps the tone of the top bar when the page is scrolled', async () => {
    const header = requireElement(hostElement(fixture), '.tb-shell__header', HTMLElement);
    const before = header.className;

    vi.spyOn(window, 'scrollY', 'get').mockReturnValue(120);
    window.dispatchEvent(new Event('scroll'));
    await fixture.whenStable();
    expect(header.className).toBe(before);
  });

  it('has no notification bell for the administrator', async () => {
    expect(hostElement(fixture).querySelector('tb-notification-bell')).not.toBeNull();

    fixture.componentRef.setInput('notifications', false);
    await fixture.whenStable();

    expect(hostElement(fixture).querySelector('tb-notification-bell')).toBeNull();
  });

  it('switches the theme from the user menu', async () => {
    requireElement(hostElement(fixture), '.tb-shell__user-button', HTMLButtonElement).click();
    await fixture.whenStable();

    const user = requireElement(hostElement(fixture), '.tb-shell__user-button', HTMLButtonElement);
    expect(user.getAttribute('aria-haspopup')).toBe('menu');
    expect(user.getAttribute('aria-expanded')).toBe('true');
    // the chosen theme is highlighted, its label stays; screen readers hear a checked radio item
    const chosen = document.body.querySelector('li.tb-menu-item--selected');
    expect(chosen?.textContent.trim()).toBe('Тема как в системе');
    expect(chosen?.getAttribute('role')).toBe('menuitemradio');
    expect(chosen?.getAttribute('aria-checked')).toBe('true');
    const light = Array.from(document.body.querySelectorAll('li.tb-menu-item--choice')).find(
      (item) => item.textContent.includes('Светлая тема'),
    );
    expect(light?.getAttribute('aria-checked')).toBe('false');
    const dark = Array.from(document.body.querySelectorAll('a')).find((element) =>
      element.textContent.includes('Тёмная тема'),
    );
    dark?.click();

    expect(TestBed.inject(ThemeMode).choice()).toBe('dark');
    TestBed.inject(ThemeMode).choose('system');
    localStorage.clear();
  });

  it('switches the language under the theme (ADR-0035)', async () => {
    const reload = vi.spyOn(pageReload, 'now').mockImplementation(() => undefined);
    requireElement(hostElement(fixture), '.tb-shell__user-button', HTMLButtonElement).click();
    await fixture.whenStable();

    const items = Array.from(document.body.querySelectorAll('a')).map((a) => a.textContent.trim());
    const russian = items.indexOf('Русский');
    expect(russian).toBeGreaterThan(items.findIndex((item) => item.includes('Тёмная тема')));
    const chosen = Array.from(document.body.querySelectorAll('li.tb-menu-item--choice')).find(
      (item) => item.textContent.trim() === 'Русский',
    );
    expect(chosen?.getAttribute('aria-checked')).toBe('true');
    const english = Array.from(document.body.querySelectorAll('a')).find(
      (element) => element.textContent.trim() === 'English',
    );
    english?.click();

    expect(localStorage.getItem(LANGUAGE_KEY)).toBe('en');
    expect(reload).toHaveBeenCalledOnce();
    localStorage.clear();
    forgetLanguage();
  });

  it('signs out from the user menu', async () => {
    requireElement(hostElement(fixture), '.tb-shell__user-button', HTMLButtonElement).click();
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
    const user = requireElement(host, '.tb-shell__user-button', HTMLButtonElement);
    expect(user.textContent).toContain('Анна');
    // the visible name is the start of the accessible one (WCAG 2.5.3)
    expect(user.getAttribute('aria-label')).toMatch(/^Анна.*: меню пользователя$/);
    fixture.destroy();
  });
});
