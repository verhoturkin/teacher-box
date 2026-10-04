import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { hostElement } from '@testing/dom';
import { testProvidersWithRouter } from '@testing/setup';
import { SideNav } from './side-nav';
import { TEACHER_MENU } from './teacher-layout';

describe('SideNav', () => {
  let fixture: ComponentFixture<SideNav>;

  async function render(rail: boolean): Promise<HTMLElement> {
    TestBed.configureTestingModule({
      imports: [SideNav],
      providers: testProvidersWithRouter(provideRouter([{ path: '**', children: [] }])),
    });
    fixture = TestBed.createComponent(SideNav);
    fixture.componentRef.setInput('items', TEACHER_MENU);
    fixture.componentRef.setInput('rail', rail);
    await TestBed.inject(Router).navigateByUrl('/teacher/students');
    await fixture.whenStable();
    return hostElement(fixture);
  }

  afterEach(() => {
    fixture.destroy();
  });

  it('lists every section of the role as links and marks the current page (ADR-0024)', async () => {
    const host = await render(false);

    expect(host.getAttribute('role')).toBe('navigation');
    expect(host.getAttribute('aria-label')).toBe('Разделы');
    expect(host.querySelector('[role="menu"], [role="menuitem"]')).toBeNull();
    const links = Array.from(host.querySelectorAll('a'));
    expect(links.map((link) => link.textContent.trim())).toEqual(
      TEACHER_MENU.map((item) => item.label),
    );
    const current = host.querySelector('a[aria-current="page"]');
    expect(current?.textContent).toContain('Ученики');
    expect(current?.classList).toContain('tb-side-nav__item--active');
    expect(host.querySelectorAll('a[aria-current]')).toHaveLength(1);
    expect(host.classList).not.toContain('tb-side-nav--rail');
  });

  it('becomes the narrow rail', async () => {
    const host = await render(true);

    expect(host.classList).toContain('tb-side-nav--rail');
    expect(host.querySelectorAll('a')).toHaveLength(TEACHER_MENU.length);
  });
});
