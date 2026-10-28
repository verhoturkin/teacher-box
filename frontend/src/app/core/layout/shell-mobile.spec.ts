import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Router, provideRouter } from '@angular/router';
import { MenuItem } from 'primeng/api';
import { Drawer } from 'primeng/drawer';
import { AuthService } from '@core/auth/auth.service';
import { authResponse } from '@testing/auth';
import { hostElement, requireElement } from '@testing/dom';
import { screenWidth, testProvidersWithRouter } from '@testing/setup';
import { RailState } from './rail-state';
import { Shell } from './shell';
import { STUDENT_BOTTOM_NAV, studentMenu } from './student-layout';
import { TEACHER_BOTTOM_NAV, TEACHER_FOOTER_LINKS, TEACHER_MENU } from './teacher-layout';

describe('Shell on a phone', () => {
  let fixture: ComponentFixture<Shell>;

  async function render(
    items: MenuItem[],
    bottomNav: readonly string[] = [],
    url = '/teacher',
    search = false,
  ): Promise<HTMLElement> {
    TestBed.configureTestingModule({
      imports: [Shell],
      providers: testProvidersWithRouter(
        provideRouter([{ path: '**', children: [] }]),
        screenWidth(599),
      ),
    });
    TestBed.inject(AuthService).acceptSession(authResponse('TEACHER'));
    fixture = TestBed.createComponent(Shell);
    fixture.componentRef.setInput('items', items);
    fixture.componentRef.setInput('bottomNav', bottomNav);
    fixture.componentRef.setInput('search', search);
    fixture.componentRef.setInput('footerLinks', TEACHER_FOOTER_LINKS);
    fixture.componentRef.setInput('homeLink', '/teacher');
    await TestBed.inject(Router).navigateByUrl(url);
    await fixture.whenStable();
    return hostElement(fixture);
  }

  const labels = (root: ParentNode, selector: string): string[] =>
    Array.from(root.querySelectorAll(selector)).map(
      (link) =>
        link.querySelector('.tb-side-nav__label')?.textContent.trim() ?? link.textContent.trim(),
    );

  /** The ☰ of the top app bar. */
  const menuButton = (host: HTMLElement): HTMLButtonElement =>
    requireElement(host, '.tb-shell__header button[aria-label="Разделы"]', HTMLButtonElement);

  /** Opens the modal rail with ☰ and waits for it. */
  async function openRail(host: HTMLElement): Promise<HTMLElement> {
    const button = menuButton(host);
    button.focus();
    button.click();
    await fixture.whenStable();
    // jsdom runs no animation: the drawer is shown as when its animation ends
    // (the other drawer of the frame is the bell's sheet)
    fixture.debugElement
      .queryAll(By.directive(Drawer))
      .map((element) => element.injector.get(Drawer))
      .find((drawer) => drawer.styleClass === 'tb-modal-rail')
      ?.show();
    return requireElement(document.body, '.p-drawer.tb-modal-rail', HTMLElement);
  }

  afterEach(() => {
    fixture.destroy();
  });

  it('opens the full-screen search from the icon of the top app bar and on Ctrl K', async () => {
    const host = await render(TEACHER_MENU, TEACHER_BOTTOM_NAV, '/teacher', true);
    expect(host.querySelector('.tb-search')).toBeNull();
    const button = requireElement(
      host,
      '.tb-shell__header button[aria-label="Открыть поиск"]',
      HTMLButtonElement,
    );

    button.focus();
    button.click();
    await fixture.whenStable();
    const dialog = requireElement(host, 'tb-global-search .tb-search[role="dialog"]', HTMLElement);
    expect(document.activeElement).toBe(dialog.querySelector('input'));

    dialog
      .querySelector('input')
      ?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await fixture.whenStable();
    expect(host.querySelector('.tb-search')).toBeNull();
    expect(document.activeElement).toBe(button);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }));
    await fixture.whenStable();
    expect(host.querySelector('.tb-search[role="dialog"]')).not.toBeNull();
  });

  it('has no search icon without a search', async () => {
    const host = await render(TEACHER_MENU, TEACHER_BOTTOM_NAV);

    expect(host.querySelector('button[aria-label="Открыть поиск"]')).toBeNull();
  });

  it('puts five sections of the teacher in the bottom bar and no «Ещё» (D2)', async () => {
    const host = await render(TEACHER_MENU, TEACHER_BOTTOM_NAV);

    const nav = requireElement(host, 'nav.tb-bottom-nav', HTMLElement);
    expect(labels(nav, 'a')).toEqual(['Сегодня', 'Расписание', 'Задания', 'Ученики', 'Оплаты']);
    expect(nav.querySelector('button')).toBeNull();
    expect(host.textContent).not.toContain('Ещё');
    expect(host.querySelector('tb-side-nav')).toBeNull();
    expect(host.querySelector('.tb-shell__content--nav')).not.toBeNull();
  });

  it('keeps «Ученики» active and titled on the card of a group', async () => {
    const host = await render(TEACHER_MENU, TEACHER_BOTTOM_NAV, '/teacher/groups/g-1');

    const current = host.querySelectorAll('nav.tb-bottom-nav a[aria-current="page"]');
    expect(current).toHaveLength(1);
    expect(current[0]?.textContent).toContain('Ученики');
    expect(current[0]?.classList).toContain('tb-bottom-nav__item--active');
    expect(host.querySelector('.tb-shell__title')?.textContent.trim()).toBe('Ученики');
  });

  it('shows ☰, the title of the section, the bell and the avatar in the top app bar', async () => {
    const host = await render(TEACHER_MENU, TEACHER_BOTTOM_NAV, '/teacher/schedule/week?day=1');

    const header = requireElement(host, '.tb-shell__header', HTMLElement);
    const button = menuButton(host);
    expect(button.getAttribute('aria-haspopup')).toBe('dialog');
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(header.querySelector('.tb-shell__title')?.textContent.trim()).toBe('Расписание');
    expect(header.querySelector('tb-notification-bell')).not.toBeNull();
    // the brand is at the top of the modal rail, not in the bar (spec §3.2)
    expect(header.querySelector('.tb-shell__brand')).toBeNull();
    expect(header.textContent).not.toContain('Teacher Box');
    // the page header holds the one h1 of the page; the bar's title is not a heading
    expect(host.querySelector('h1, h2, [role="heading"]')).toBeNull();
  });

  it('names the section of the rail’s bottom group and the home page', async () => {
    const host = await render(TEACHER_MENU, TEACHER_BOTTOM_NAV, '/teacher/help/first-steps');
    expect(host.querySelector('.tb-shell__title')?.textContent.trim()).toBe('Справка');

    await TestBed.inject(Router).navigateByUrl('/teacher');
    await fixture.whenStable();
    expect(host.querySelector('.tb-shell__title')?.textContent.trim()).toBe('Сегодня');

    await TestBed.inject(Router).navigateByUrl('/teacher/settings/account');
    await fixture.whenStable();
    expect(host.querySelector('.tb-shell__title')?.textContent.trim()).toBe('Аккаунт');
  });

  it('opens the modal expanded rail with the other sections, the settings and the help', async () => {
    const host = await render(TEACHER_MENU, TEACHER_BOTTOM_NAV);

    const rail = await openRail(host);
    expect(menuButton(host).getAttribute('aria-expanded')).toBe('true');
    expect(rail.getAttribute('role')).toBe('dialog');
    expect(rail.getAttribute('aria-modal')).toBe('true');
    expect(rail.getAttribute('aria-labelledby')).not.toBeNull();
    expect(document.body.querySelector('.p-drawer-mask')).not.toBeNull();
    const nav = requireElement(rail, 'tb-side-nav', HTMLElement);
    expect(nav.classList).toContain('tb-side-nav--modal');
    expect(nav.querySelector('.tb-side-nav__brand')?.textContent).toContain('Teacher Box');
    expect(labels(nav, 'ul:not(.tb-side-nav__footer) a')).toEqual(['Материалы']);
    expect(labels(nav, 'ul.tb-side-nav__footer a')).toEqual(['Настройки', 'Справка', 'Аккаунт']);
    // the focus goes into the rail
    expect(rail.contains(document.activeElement)).toBe(true);
  });

  it('closes the modal rail with Esc and gives the focus back to ☰', async () => {
    const host = await render(TEACHER_MENU, TEACHER_BOTTOM_NAV);
    const rail = await openRail(host);

    requireElement(rail, 'a', HTMLAnchorElement).dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true }),
    );
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(menuButton(host).getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(menuButton(host));
  });

  it('closes the modal rail with its menu button and when a destination is chosen', async () => {
    const host = await render(TEACHER_MENU, TEACHER_BOTTOM_NAV);
    let rail = await openRail(host);

    requireElement(rail, 'button[aria-label="Закрыть"]', HTMLButtonElement).click();
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(menuButton(host).getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(menuButton(host));

    rail = await openRail(host);
    const boards = Array.from(rail.querySelectorAll('a')).find(
      (link) => link.textContent.trim() === 'Материалы',
    );
    boards?.click();
    await fixture.whenStable();
    expect(menuButton(host).getAttribute('aria-expanded')).toBe('false');
  });

  it('puts the five sections of the student in the bar, none is left under ☰', async () => {
    const host = await render(studentMenu(signal(0)), STUDENT_BOTTOM_NAV, '/cabinet');

    expect(labels(host, 'nav.tb-bottom-nav a')).toEqual([
      'Главная',
      'Расписание',
      'Задания',
      'Материалы',
      'Оплаты',
    ]);
    const rail = await openRail(host);
    expect(rail.querySelector('ul:not(.tb-side-nav__footer)')).toBeNull();
  });

  it('takes the first five sections without a bar order', async () => {
    const host = await render(TEACHER_MENU);

    expect(labels(host, 'nav.tb-bottom-nav a')).toEqual([
      'Сегодня',
      'Расписание',
      'Ученики',
      'Задания',
      'Материалы',
    ]);
  });

  it('has no other sections in the modal rail when all fit the bar', async () => {
    const host = await render(studentMenu(signal(0)).slice(0, 3));

    expect(host.querySelectorAll('nav.tb-bottom-nav a')).toHaveLength(3);
    const rail = await openRail(host);
    expect(rail.querySelector('ul:not(.tb-side-nav__footer)')).toBeNull();
    expect(labels(rail, 'ul.tb-side-nav__footer a')).toEqual(['Настройки', 'Справка', 'Аккаунт']);
  });

  it('hides the bottom bar while a page asks for it (the review of a work, spec §9)', async () => {
    const host = await render(TEACHER_MENU);
    expect(host.querySelector('nav.tb-bottom-nav')).not.toBeNull();

    TestBed.inject(RailState).bottomBarHidden.set(true);
    await fixture.whenStable();
    expect(host.querySelector('nav.tb-bottom-nav')).toBeNull();
    expect(host.querySelector('.tb-shell__content--nav')).toBeNull();

    TestBed.inject(RailState).bottomBarHidden.set(false);
    await fixture.whenStable();
    expect(host.querySelector('nav.tb-bottom-nav')).not.toBeNull();
  });

  it('shows the top app bar of the page in place of the bell and the account (spec §10.2)', async () => {
    const host = await render(TEACHER_MENU, TEACHER_BOTTOM_NAV, '/teacher/billing');
    const command = vi.fn();
    TestBed.inject(RailState).compactBar.set({
      title: 'Октябрь',
      menuLabel: 'Ещё',
      actions: [{ icon: 'chevron_left', label: 'Назад', command }],
      menu: [{ label: 'Отчёт' }],
    });
    await fixture.whenStable();

    expect(host.querySelector('.tb-shell__title')?.textContent.trim()).toBe('Октябрь');
    expect(host.querySelector('.tb-shell__user-button[aria-haspopup="menu"]')).toBeNull();
    requireElement(host, '.tb-shell__header button[aria-label="Назад"]', HTMLButtonElement).click();
    expect(command).toHaveBeenCalledOnce();
    requireElement(host, '.tb-shell__header button[aria-label="Ещё"]', HTMLButtonElement).click();
    await fixture.whenStable();
    expect(document.body.textContent).toContain('Отчёт');

    TestBed.inject(RailState).compactBar.set(null);
    await fixture.whenStable();
    expect(host.querySelector('.tb-shell__title')?.textContent.trim()).toBe('Оплаты');
  });
});
