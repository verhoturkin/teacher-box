import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { AuthService } from '@core/auth/auth.service';
import { Portal } from '@core/portal/portal';
import { ThemeMode } from '@core/theme/theme-mode';
import { LANGUAGE_KEY, forgetLanguage, pageReload } from '@core/i18n/language';
import { authResponse } from '@testing/auth';
import { hostElement, requireElement } from '@testing/dom';
import { Shell } from './shell';
import { screenWidth, testProviders } from '@testing/setup';
import { portalInfo } from '@testing/portal-fixtures';

describe('Shell', () => {
  let fixture: ComponentFixture<Shell>;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [Shell],
      providers: testProviders(screenWidth(1600)),
    });
    TestBed.inject(AuthService).acceptSession(authResponse('TEACHER'));
    vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    fixture = TestBed.createComponent(Shell);
    fixture.componentRef.setInput('items', [{ label: 'Ученики', routerLink: '/teacher/students' }]);
    fixture.componentRef.setInput('homeLink', '/teacher');
    fixture.componentRef.setInput('footerLinks', [
      { label: 'Настройки', routerLink: '/teacher/settings' },
    ]);
    await fixture.whenStable();
  });

  afterEach(() => {
    fixture.destroy();
  });

  it('shows the name of the portal at the top of the rail, not in the top bar (spec §3.2)', async () => {
    TestBed.inject(Portal).set(portalInfo({ name: 'Английский с Марией', address: null }));
    await fixture.whenStable();

    const host = hostElement(fixture);
    expect(host.querySelector('tb-side-nav .tb-side-nav__brand')?.textContent).toContain(
      'Английский с Марией',
    );
    expect(host.querySelector('.tb-shell__header')?.textContent).not.toContain('Английский');
    expect(host.querySelector('.tb-shell__brand')).toBeNull();
  });

  it('ends the rail with the settings and the help of the area', () => {
    const footer = requireElement(
      hostElement(fixture),
      'tb-side-nav .tb-side-nav__footer',
      HTMLElement,
    );
    const links = Array.from(footer.querySelectorAll('a'));
    expect(links.map((a) => a.textContent.trim())).toEqual(['Настройки', 'Справка']);
    expect(links.map((a) => a.getAttribute('href'))).toEqual([
      '/teacher/settings',
      '/teacher/help',
    ]);
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
    expect(button()?.querySelector('.tb-i-account_circle')).not.toBeNull();

    TestBed.inject(AuthService).profileChanged({
      displayName: 'Ника',
      avatar: '/api/public/avatars/a',
    });
    await fixture.whenStable();

    expect(button()?.querySelector('.tb-i-account_circle')).toBeNull();
    expect(button()?.querySelector('tb-avatar img')?.getAttribute('src')).toBe(
      '/api/public/avatars/a',
    );
    expect(button()?.textContent).toContain('Ника');
  });

  it('puts the sections in the expanded rail on an extra-large screen (D5)', () => {
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
    // the user menu keeps the account, the theme, the language and sign out; the settings and the
    // help are in the rail (spec §3.2)
    const menu = requireElement(document.body, '.p-menu', HTMLElement).textContent;
    expect(menu).toContain('Мой аккаунт');
    expect(menu).toContain('Тёмная тема');
    expect(menu).toContain('English');
    expect(menu).not.toContain('Настройки');
    expect(menu).not.toContain('Справка');

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

describe('Shell by the M3 breakpoint (ADR-0048)', () => {
  let fixture: ComponentFixture<Shell>;

  async function render(width: number): Promise<HTMLElement> {
    TestBed.configureTestingModule({
      imports: [Shell],
      providers: testProviders(screenWidth(width)),
    });
    TestBed.inject(AuthService).acceptSession(authResponse('TEACHER'));
    fixture = TestBed.createComponent(Shell);
    fixture.componentRef.setInput('items', [{ label: 'Ученики', routerLink: '/teacher/students' }]);
    fixture.componentRef.setInput('homeLink', '/teacher');
    fixture.componentRef.setInput('footerLinks', [
      { label: 'Настройки', routerLink: '/teacher/settings' },
    ]);
    await fixture.whenStable();
    return hostElement(fixture);
  }

  afterEach(() => {
    fixture.destroy();
  });

  it('keeps the portal, the settings and the help in the top bar on compact until the ☰ rail (231.2)', async () => {
    const host = await render(599);

    expect(host.querySelector('.tb-shell__header .tb-shell__brand')?.textContent).toContain(
      'Teacher Box',
    );
    requireElement(host, '.tb-shell__user-button', HTMLButtonElement).click();
    await fixture.whenStable();
    const menu = requireElement(document.body, '.p-menu', HTMLElement).textContent;
    expect(menu).toContain('Настройки');
    expect(menu).toContain('Справка');
    expect(menu).toContain('Мой аккаунт');
  });

  it.each([
    [599, 'bar'],
    [600, 'rail'],
    [839, 'rail'],
    [840, 'rail'],
    [1199, 'rail'],
    [1200, 'rail'],
    [1599, 'rail'],
    [1600, 'expanded rail'],
  ])('at %i px shows the %s', async (width, navigation) => {
    const host = await render(width);

    const nav = host.querySelector('tb-side-nav');
    expect(host.querySelector('nav.tb-bottom-nav') !== null).toBe(navigation === 'bar');
    expect(nav !== null).toBe(navigation !== 'bar');
    expect(nav?.classList.contains('tb-side-nav--rail') ?? false).toBe(navigation === 'rail');
  });

  it('keeps the name on the user button from medium', async () => {
    const host = await render(600);

    const user = requireElement(host, '.tb-shell__user-button', HTMLButtonElement);
    expect(user.textContent).toContain('Анна');
    // the visible name is the start of the accessible one (WCAG 2.5.3)
    expect(user.getAttribute('aria-label')).toMatch(/^Анна.*: меню пользователя$/);
  });
});
