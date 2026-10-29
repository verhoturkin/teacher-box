import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { AuthService } from '@core/auth/auth.service';
import { NotificationsSheetState } from '@core/notifications/notifications-sheet-state';
import { Portal } from '@core/portal/portal';
import { authResponse } from '@testing/auth';
import { hostElement, requireElement } from '@testing/dom';
import { RailState } from './rail-state';
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

  it('has no search bar unless the area asks for it (the student and the administrator have none)', () => {
    expect(hostElement(fixture).querySelector('tb-global-search')).toBeNull();
  });

  it('puts the search bar in the top strip and Ctrl K / ⌘ K focuses it', async () => {
    fixture.componentRef.setInput('search', true);
    await fixture.whenStable();
    const host = hostElement(fixture);
    const field = requireElement(
      host,
      '.tb-shell__header tb-global-search input[role="combobox"]',
      HTMLInputElement,
    );

    const ctrl = new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, cancelable: true });
    document.dispatchEvent(ctrl);
    expect(ctrl.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(field);

    field.blur();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'K', metaKey: true }));
    expect(document.activeElement).toBe(field);

    field.blur();
    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, shiftKey: true }),
    );
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k' }));
    expect(document.activeElement).not.toBe(field);
  });

  it('ignores Ctrl K when there is no search', () => {
    const ctrl = new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, cancelable: true });
    document.dispatchEvent(ctrl);

    expect(ctrl.defaultPrevented).toBe(false);
  });

  it('ends the rail with the settings and the help of the area', () => {
    const footer = requireElement(
      hostElement(fixture),
      'tb-side-nav .tb-side-nav__footer',
      HTMLElement,
    );
    const links = Array.from(footer.querySelectorAll('a'));
    expect(
      links.map((a) => a.querySelector('.tb-side-nav__label')?.textContent.trim() ?? ''),
    ).toEqual(['Настройки', 'Справка', 'Анна Сергеевна']);
    expect(links.map((a) => a.getAttribute('href'))).toEqual([
      '/teacher/settings',
      '/teacher/help',
      '/teacher/settings/account',
    ]);
    expect(links[2]?.getAttribute('aria-label')).toBe('Аккаунт: Анна Сергеевна');
  });

  it('shows the navigation and the user, but not the name of the area (ADR-0019)', () => {
    const text = hostElement(fixture).textContent;
    expect(text).toContain('Teacher Box');
    expect(text).toContain('Ученики');
    expect(text).not.toContain('Кабинет учителя');
  });

  it('keeps only the bell in the top strip, the account is in the rail (spec §3.2)', () => {
    const header = requireElement(hostElement(fixture), '.tb-shell__header', HTMLElement);

    expect(header.querySelector('tb-notification-bell')).not.toBeNull();
    expect(header.querySelector('button[aria-label^="Аккаунт"]')).toBeNull();
    expect(header.querySelector('button[aria-label="Разделы"]')).toBeNull();
    expect(header.querySelector('.tb-shell__title')).toBeNull();
    expect(header.textContent.trim()).toBe('');
    expect(document.body.querySelector('.tb-modal-rail')).toBeNull();
  });

  it('shows the photo of the user on the account item, the initials without one', async () => {
    const item = () => hostElement(fixture).querySelector('a[aria-label^="Аккаунт"]');
    expect(item()?.querySelector('tb-avatar img')).toBeNull();
    expect(item()?.querySelector('tb-avatar')?.textContent.trim()).not.toBe('');

    TestBed.inject(AuthService).profileChanged({
      displayName: 'Ника',
      avatar: '/api/public/avatars/a',
    });
    await fixture.whenStable();

    expect(item()?.querySelector('tb-avatar img')?.getAttribute('src')).toBe(
      '/api/public/avatars/a',
    );
    expect(item()?.getAttribute('aria-label')).toBe('Аккаунт: Ника');
  });

  it('puts the sections in the expanded rail on an extra-large screen (D5)', () => {
    const nav = hostElement(fixture).querySelector('tb-side-nav');
    expect(nav?.classList).not.toContain('tb-side-nav--rail');
    expect(nav?.textContent).toContain('Ученики');
    expect(hostElement(fixture).querySelector('nav.tb-bottom-nav')).toBeNull();
  });

  it('collapses the expanded rail to 96 px while a page asks for it (spec §9)', async () => {
    TestBed.inject(RailState).collapsed.set(true);
    await fixture.whenStable();

    const host = hostElement(fixture);
    expect(host.querySelector('tb-side-nav')?.classList).toContain('tb-side-nav--rail');
    expect(host.classList).not.toContain('tb-shell--wide');

    TestBed.inject(RailState).collapsed.set(false);
    await fixture.whenStable();
    expect(host.querySelector('tb-side-nav')?.classList).not.toContain('tb-side-nav--rail');
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

  it('has no user button in the top bar on compact: the account is under ☰', async () => {
    const host = await render(599);

    expect(host.querySelector('.tb-shell__header button[aria-label^="Аккаунт"]')).toBeNull();
    requireElement(host, 'button[aria-label="Разделы"]', HTMLButtonElement).click();
    await fixture.whenStable();
    const rail = requireElement(document.body, '.tb-modal-rail', HTMLElement);
    expect(rail.textContent).toContain('Настройки');
    expect(rail.textContent).toContain('Справка');
    expect(rail.querySelector('a[aria-label^="Аккаунт"]')).not.toBeNull();
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

  it.each([
    [599, 'nothing'],
    [600, 'the FAB'],
    [1599, 'the FAB'],
    [1600, 'the small extended FAB'],
  ])('at %i px «Создать» is %s', async (width, kind) => {
    TestBed.configureTestingModule({
      imports: [Shell],
      providers: testProviders(screenWidth(width)),
    });
    TestBed.inject(AuthService).acceptSession(authResponse('TEACHER'));
    fixture = TestBed.createComponent(Shell);
    fixture.componentRef.setInput('items', [{ label: 'Ученики', routerLink: '/teacher/students' }]);
    fixture.componentRef.setInput('homeLink', '/teacher');
    fixture.componentRef.setInput('create', true);
    await fixture.whenStable();
    const host = hostElement(fixture);

    const menu = host.querySelector('tb-side-nav tb-fab-menu');
    expect(menu !== null).toBe(kind !== 'nothing');
    expect(menu?.classList.contains('tb-fab-menu--extended') ?? false).toBe(
      kind === 'the small extended FAB',
    );
  });

  it('has no «Создать» unless the area asks for it', async () => {
    const host = await render(1600);

    expect(host.querySelector('tb-create-menu')).toBeNull();
  });

  it.each([599, 600, 1600])('has no account button in the top bar at %i px', async (width) => {
    const host = await render(width);

    expect(host.querySelector('.tb-shell__header button[aria-label^="Аккаунт"]')).toBeNull();
    expect(host.querySelector('.tb-shell__user-button')).toBeNull();
  });

  it.each([
    [599, 'the whole-screen modal sheet'],
    [600, 'the modal sheet'],
    [1599, 'the modal sheet'],
    [1600, 'the third pane'],
  ])('at %i px the bell opens %s (spec §10.3)', async (width, kind) => {
    const host = await render(width);

    TestBed.inject(NotificationsSheetState).show();
    await fixture.whenStable();

    const pane = host.querySelector('.tb-shell__body > tb-notifications-sheet aside');
    const drawer = document.body.querySelector('.p-drawer.tb-side-sheet--narrow');
    expect(pane !== null).toBe(kind === 'the third pane');
    expect(drawer !== null).toBe(kind !== 'the third pane');
    TestBed.inject(NotificationsSheetState).close();
    await fixture.whenStable();
  });

  it('has no sheet of notifications for the administrator', async () => {
    await render(1600);
    fixture.componentRef.setInput('notifications', false);
    await fixture.whenStable();

    expect(hostElement(fixture).querySelector('tb-notifications-sheet')).toBeNull();
    expect(hostElement(fixture).querySelector('tb-notification-bell')).toBeNull();
  });
});
