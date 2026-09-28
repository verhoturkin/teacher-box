import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MenuItem } from 'primeng/api';
import { AuthService } from '@core/auth/auth.service';
import { authResponse } from '@testing/auth';
import { bodyText, hostElement, requireElement } from '@testing/dom';
import { phoneScreen, testProviders } from '@testing/setup';
import { Shell } from './shell';
import { STUDENT_MENU } from './student-layout';
import { TEACHER_MENU } from './teacher-layout';

describe('Shell on a phone', () => {
  let fixture: ComponentFixture<Shell>;

  async function render(items: MenuItem[]): Promise<HTMLElement> {
    TestBed.configureTestingModule({
      imports: [Shell],
      providers: testProviders(phoneScreen()),
    });
    TestBed.inject(AuthService).acceptSession(authResponse('TEACHER'));
    fixture = TestBed.createComponent(Shell);
    fixture.componentRef.setInput('items', items);
    fixture.componentRef.setInput('homeLink', '/teacher');
    fixture.componentRef.setInput('areaTitle', 'Кабинет учителя');
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
    expect(host.querySelector('.p-menubar-root-list')?.children.length ?? 0).toBe(0);
    expect(
      requireElement(host, 'button[aria-label="Меню пользователя"]', HTMLButtonElement).textContent,
    ).not.toContain('Анна');

    requireElement(nav, 'button[aria-label="Ещё разделы"]', HTMLButtonElement).click();
    await fixture.whenStable();
    expect(bodyText()).toContain('Оплаты');
    expect(bodyText()).toContain('ИИ');
  });

  it('has no «Ещё» when four sections are all', async () => {
    const host = await render(STUDENT_MENU);

    expect(host.querySelectorAll('nav.tb-bottom-nav a')).toHaveLength(4);
    expect(host.querySelector('button[aria-label="Ещё разделы"]')).toBeNull();
    expect(host.querySelector('.tb-shell__content--nav')).not.toBeNull();
  });
});
