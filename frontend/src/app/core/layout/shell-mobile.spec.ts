import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { MenuItem } from 'primeng/api';
import { AuthService } from '@core/auth/auth.service';
import { authResponse } from '@testing/auth';
import { bodyText, hostElement, requireElement } from '@testing/dom';
import { phoneScreen, testProvidersWithRouter } from '@testing/setup';
import { Shell } from './shell';
import { STUDENT_BOTTOM_NAV, STUDENT_MENU } from './student-layout';
import { TEACHER_BOTTOM_NAV, TEACHER_MENU } from './teacher-layout';

describe('Shell on a phone', () => {
  let fixture: ComponentFixture<Shell>;

  async function render(
    items: MenuItem[],
    bottomNav: readonly string[] = [],
  ): Promise<HTMLElement> {
    TestBed.configureTestingModule({
      imports: [Shell],
      providers: testProvidersWithRouter(
        provideRouter([{ path: '**', children: [] }]),
        phoneScreen(),
      ),
    });
    TestBed.inject(AuthService).acceptSession(authResponse('TEACHER'));
    fixture = TestBed.createComponent(Shell);
    fixture.componentRef.setInput('items', items);
    fixture.componentRef.setInput('bottomNav', bottomNav);
    fixture.componentRef.setInput('homeLink', '/teacher');
    await fixture.whenStable();
    return hostElement(fixture);
  }

  afterEach(() => {
    fixture.destroy();
  });

  it('moves the sections to the bottom navigation with «Ещё»', async () => {
    const host = await render(TEACHER_MENU, TEACHER_BOTTOM_NAV);

    const nav = requireElement(host, 'nav.tb-bottom-nav', HTMLElement);
    expect(Array.from(nav.querySelectorAll('a')).map((link) => link.textContent.trim())).toEqual([
      'Главная',
      'Расписание',
      'Доски',
      'Оплаты',
    ]);
    expect(host.querySelector('tb-side-nav')).toBeNull();
    const user = requireElement(host, 'button[aria-label="Меню пользователя"]', HTMLButtonElement);
    expect(user.textContent).not.toContain('Анна');
    // a circle around the photo or the icon, not a pill
    expect(user.classList).toContain('tb-shell__user-button--round');

    const more = requireElement(nav, 'button[aria-label="Ещё разделы"]', HTMLButtonElement);
    expect(more.getAttribute('aria-haspopup')).toBe('menu');
    more.click();
    await fixture.whenStable();
    expect(more.getAttribute('aria-expanded')).toBe('true');
    // four sections and «Ещё» (ADR-0027): the rest of the sections are in the menu
    expect(bodyText()).toContain('Звонки');
    expect(bodyText()).toContain('Ученики');
    expect(bodyText()).toContain('Задания');
    expect(bodyText()).toContain('Уведомления');
    expect(bodyText()).toContain('ИИ');
    expect(nav.children).toHaveLength(5);
  });

  it('marks «Ещё» when the page is a section from it', async () => {
    const host = await render(TEACHER_MENU);
    await TestBed.inject(Router).navigateByUrl('/teacher/notifications?open=messengers');
    await fixture.whenStable();

    const more = requireElement(host, 'button[aria-label="Ещё разделы"]', HTMLButtonElement);
    expect(more.classList).toContain('tb-bottom-nav__item--active');
    expect(more.getAttribute('aria-current')).toBe('page');

    // the chosen section stands out in the menu
    more.click();
    await fixture.whenStable();
    const chosen = document.body.querySelector('.p-menu .tb-menu-item--selected');
    expect(chosen?.textContent).toContain('Уведомления');
    expect(document.body.querySelectorAll('.p-menu .tb-menu-item--selected')).toHaveLength(1);
  });

  it('has no «Ещё» when all five sections fit', async () => {
    const host = await render(STUDENT_MENU.slice(0, 5));

    expect(host.querySelectorAll('nav.tb-bottom-nav a')).toHaveLength(5);
    expect(host.querySelector('button[aria-label="Ещё разделы"]')).toBeNull();
    expect(host.querySelector('.tb-shell__content--nav')).not.toBeNull();
  });

  it('keeps the order of the sections without a bottom bar order', async () => {
    const host = await render(TEACHER_MENU);

    expect(
      Array.from(host.querySelectorAll('nav.tb-bottom-nav a')).map((link) =>
        link.textContent.trim(),
      ),
    ).toEqual(['Главная', 'Расписание', 'Звонки', 'Ученики']);
  });

  it('puts the sixth section of the student under «Ещё»', async () => {
    const host = await render(STUDENT_MENU, STUDENT_BOTTOM_NAV);

    expect(
      Array.from(host.querySelectorAll('nav.tb-bottom-nav a')).map((link) =>
        link.textContent.trim(),
      ),
    ).toEqual(['Главная', 'Расписание', 'Мои доски', 'Оплаты']);
    expect(host.querySelector('button[aria-label="Ещё разделы"]')).not.toBeNull();
  });
});
