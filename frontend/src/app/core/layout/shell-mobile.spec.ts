import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { MenuItem } from 'primeng/api';
import { AuthService } from '@core/auth/auth.service';
import { authResponse } from '@testing/auth';
import { bodyText, hostElement, requireElement } from '@testing/dom';
import { phoneScreen, testProvidersWithRouter } from '@testing/setup';
import { Shell } from './shell';
import { STUDENT_MENU } from './student-layout';
import { TEACHER_MENU } from './teacher-layout';

describe('Shell on a phone', () => {
  let fixture: ComponentFixture<Shell>;

  async function render(items: MenuItem[]): Promise<HTMLElement> {
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
    fixture.componentRef.setInput('homeLink', '/teacher');
    await fixture.whenStable();
    return hostElement(fixture);
  }

  afterEach(() => {
    fixture.destroy();
  });

  it('moves the sections to the bottom navigation with «Ещё»', async () => {
    const host = await render(TEACHER_MENU);

    const nav = requireElement(host, 'nav.tb-bottom-nav', HTMLElement);
    expect(Array.from(nav.querySelectorAll('a')).map((link) => link.textContent.trim())).toEqual([
      'Главная',
      'Расписание',
      'Ученики',
      'Задания',
    ]);
    expect(host.querySelector('tb-side-nav')).toBeNull();
    expect(
      requireElement(host, 'button[aria-label="Меню пользователя"]', HTMLButtonElement).textContent,
    ).not.toContain('Анна');

    const more = requireElement(nav, 'button[aria-label="Ещё разделы"]', HTMLButtonElement);
    expect(more.getAttribute('aria-haspopup')).toBe('menu');
    more.click();
    await fixture.whenStable();
    expect(more.getAttribute('aria-expanded')).toBe('true');
    // four sections and «Ещё» (ADR-0027): the rest of the sections are in the menu
    expect(bodyText()).toContain('Оплаты');
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

  it('has no «Ещё» when all sections fit', async () => {
    const host = await render(STUDENT_MENU);

    expect(host.querySelectorAll('nav.tb-bottom-nav a')).toHaveLength(4);
    expect(host.querySelector('button[aria-label="Ещё разделы"]')).toBeNull();
    expect(host.querySelector('.tb-shell__content--nav')).not.toBeNull();
  });
});
