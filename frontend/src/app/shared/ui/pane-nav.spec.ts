import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { hostElement } from '@testing/dom';
import { PaneNav } from './pane-nav';

describe('PaneNav', () => {
  let fixture: ComponentFixture<PaneNav>;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [PaneNav], providers: [provideRouter([])] });
    fixture = TestBed.createComponent(PaneNav);
    fixture.componentRef.setInput('items', [
      { id: 'a', icon: 'tb-i-link', title: 'Alpha', summary: 'First', badge: 2 },
      { id: 'b', icon: 'tb-i-lock', title: 'Beta', summary: 'Second' },
    ]);
    fixture.componentRef.setInput('base', '/x');
    fixture.componentRef.setInput('label', 'Sections');
    fixture.componentRef.setInput('current', 'b');
    fixture.detectChanges();
  });

  it('links the items under the base and marks the current one', () => {
    const links = Array.from(hostElement(fixture).querySelectorAll('a'));

    expect(links.map((link) => link.getAttribute('href'))).toEqual(['/x/a', '/x/b']);
    expect(links[0]?.getAttribute('aria-current')).toBeNull();
    expect(links[1]?.getAttribute('aria-current')).toBe('page');
  });

  it('shows a badge only when the count is above zero', () => {
    const badges = hostElement(fixture).querySelectorAll('p-badge');

    expect(badges).toHaveLength(1);
    expect(badges[0]?.textContent).toContain('2');
  });
});
