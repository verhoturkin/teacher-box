import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { hostElement, requireElement } from '@testing/dom';
import { testProvidersWithRouter } from '@testing/setup';
import { SideNav } from './side-nav';
import { TEACHER_FOOTER_LINKS, TEACHER_MENU } from './teacher-layout';

describe('SideNav', () => {
  let fixture: ComponentFixture<SideNav>;

  async function render(rail: boolean, url = '/teacher/students'): Promise<HTMLElement> {
    TestBed.configureTestingModule({
      imports: [SideNav],
      providers: testProvidersWithRouter(provideRouter([{ path: '**', children: [] }])),
    });
    fixture = TestBed.createComponent(SideNav);
    fixture.componentRef.setInput('items', TEACHER_MENU);
    fixture.componentRef.setInput('rail', rail);
    fixture.componentRef.setInput('footer', [
      ...TEACHER_FOOTER_LINKS,
      { label: 'Справка', icon: 'tb-i tb-i-help', routerLink: '/teacher/help' },
    ]);
    await TestBed.inject(Router).navigateByUrl(url);
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
    const links = Array.from(
      host.querySelectorAll('.tb-side-nav__list:not(.tb-side-nav__footer) a'),
    );
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
    expect(host.querySelectorAll('a')).toHaveLength(TEACHER_MENU.length + 2);
    // the logo alone fits the 96 px rail; the name stays for screen readers
    const name = requireElement(host, '.tb-side-nav__brand-name', HTMLElement);
    expect(name.classList).toContain('tb-sr-only');
    expect(name.textContent).toContain('Teacher Box');
  });

  it('puts the brand at the top: the logo and the portal name, not a button (spec §3.2)', async () => {
    const host = await render(false);

    const brand = requireElement(host, '.tb-side-nav__brand', HTMLElement);
    expect(host.firstElementChild).toBe(brand);
    expect(brand.querySelector('tb-portal-logo')).not.toBeNull();
    expect(brand.textContent).toContain('Teacher Box');
    expect(brand.querySelector('a, button')).toBeNull();
    expect(brand.closest('a, button')).toBeNull();
    expect(brand.querySelector('.tb-side-nav__brand-name')?.classList).not.toContain('tb-sr-only');
  });

  it('ends with Настройки and Справка after a spacer, marking the current one', async () => {
    const host = await render(false, '/teacher/help/first-steps');

    const footer = requireElement(host, 'ul.tb-side-nav__footer', HTMLElement);
    expect(host.lastElementChild).toBe(footer);
    expect(Array.from(footer.querySelectorAll('a')).map((a) => a.textContent.trim())).toEqual([
      'Настройки',
      'Справка',
    ]);
    expect(footer.querySelector('a[aria-current="page"]')?.textContent).toContain('Справка');
    expect(host.querySelectorAll('a[aria-current]')).toHaveLength(1);
  });

  it('has no bottom group without links', async () => {
    const host = await render(false);
    fixture.componentRef.setInput('footer', []);
    await fixture.whenStable();

    expect(host.querySelector('.tb-side-nav__footer')).toBeNull();
  });
});
