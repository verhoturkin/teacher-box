import { Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from '@core/auth/auth.service';
import { Role } from '@core/auth/auth.models';
import { authResponse } from '@testing/auth';
import { hostElement, requireElement } from '@testing/dom';
import { screenWidth, testProvidersWithRouter } from '@testing/setup';
import { ADMIN_MENU, AdminLayout } from './admin-layout';
import { STUDENT_MENU, StudentLayout } from './student-layout';
import { TEACHER_MENU, TeacherLayout } from './teacher-layout';

describe('The rail of each role (spec §3.2)', () => {
  it.each<[string, Type<unknown>, Role, string[], string[]]>([
    [
      'teacher',
      TeacherLayout,
      'TEACHER',
      TEACHER_MENU.map((item) => String(item.label)),
      ['/teacher/settings', '/teacher/help'],
    ],
    [
      'student',
      StudentLayout,
      'STUDENT',
      STUDENT_MENU.map((item) => String(item.label)),
      ['/cabinet/help'],
    ],
    [
      'administrator',
      AdminLayout,
      'ADMIN',
      ADMIN_MENU.map((item) => String(item.label)),
      ['/admin/settings', '/admin/help'],
    ],
  ])(
    'of the %s: the brand, «Создать» of the teacher, the sections, then the settings and the help',
    async (_, layout, role, sections, footer) => {
      TestBed.configureTestingModule({
        imports: [layout],
        providers: testProvidersWithRouter(
          provideRouter([{ path: '**', children: [] }]),
          screenWidth(1600),
        ),
      });
      TestBed.inject(AuthService).acceptSession(authResponse(role));
      const fixture = TestBed.createComponent(layout);
      await fixture.whenStable();
      const nav = requireElement(hostElement(fixture), 'tb-side-nav', HTMLElement);

      expect(nav.querySelector('.tb-side-nav__brand')?.textContent).toContain('Teacher Box');
      // the global «Создать» right under the brand, the teacher's only (ADR-0048)
      const create = nav.querySelector('.tb-side-nav__brand + tb-create-menu');
      expect(create !== null).toBe(role === 'TEACHER');
      expect(nav.querySelectorAll('tb-create-menu')).toHaveLength(role === 'TEACHER' ? 1 : 0);
      const main = Array.from(nav.querySelectorAll('ul:not(.tb-side-nav__footer) a'));
      expect(main.map((a) => a.textContent.trim())).toEqual(sections);
      const bottom = Array.from(nav.querySelectorAll('ul.tb-side-nav__footer a'));
      expect(bottom.map((a) => a.getAttribute('href'))).toEqual(footer);
      // a destination is either a section or at the bottom, never both
      expect(main.map((a) => a.getAttribute('href'))).not.toContain(footer[0]);
      fixture.destroy();
    },
  );
});

describe('The phone navigation of each role (spec §3.1, D2)', () => {
  it.each<[string, Type<unknown>, Role, string[], string[]]>([
    [
      'teacher',
      TeacherLayout,
      'TEACHER',
      ['Главная', 'Расписание', 'Задания', 'Ученики', 'Оплаты'],
      ['Учебники', 'Доски', 'Уведомления', 'ИИ-помощник', 'Настройки', 'Справка'],
    ],
    [
      'student',
      StudentLayout,
      'STUDENT',
      ['Главная', 'Расписание', 'Задания', 'Мои доски', 'Оплаты'],
      ['Учебники', 'Справка'],
    ],
    [
      'administrator',
      AdminLayout,
      'ADMIN',
      ['Состояние', 'Журнал', 'Интеграции', 'Копии', 'События'],
      ['Диагностика', 'Настройки', 'Справка'],
    ],
  ])(
    'of the %s: five sections in the bar, the rest under ☰, no «Ещё»',
    async (_, layout, role, bar, rail) => {
      TestBed.configureTestingModule({
        imports: [layout],
        providers: testProvidersWithRouter(
          provideRouter([{ path: '**', children: [] }]),
          screenWidth(599),
        ),
      });
      TestBed.inject(AuthService).acceptSession(authResponse(role));
      const fixture = TestBed.createComponent(layout);
      await fixture.whenStable();
      const host = hostElement(fixture);
      const texts = (root: ParentNode, selector: string) =>
        Array.from(root.querySelectorAll(selector)).map((a) => a.textContent.trim());

      expect(texts(host, 'nav.tb-bottom-nav a')).toEqual(bar);
      expect(host.querySelector('nav.tb-bottom-nav button')).toBeNull();
      expect(host.textContent).not.toContain('Ещё');
      requireElement(host, 'button[aria-label="Разделы"]', HTMLButtonElement).click();
      await fixture.whenStable();
      const modal = requireElement(document.body, '.tb-modal-rail', HTMLElement);
      expect(texts(modal, 'tb-side-nav a')).toEqual(rail);
      // on a phone the sections keep their own create actions: no «Создать» in the modal rail
      expect(document.body.querySelector('tb-create-menu')).toBeNull();
      fixture.destroy();
    },
  );
});
