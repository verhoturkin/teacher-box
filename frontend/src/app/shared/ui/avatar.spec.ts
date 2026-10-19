import { TestBed } from '@angular/core/testing';
import { hostElement } from '@testing/dom';
import { Avatar } from './avatar';

describe('Avatar', () => {
  function render(name: string, photo: string | null, size: string | null = null) {
    TestBed.configureTestingModule({ imports: [Avatar] });
    const fixture = TestBed.createComponent(Avatar);
    fixture.componentRef.setInput('name', name);
    fixture.componentRef.setInput('photo', photo);
    fixture.componentRef.setInput('size', size);
    fixture.detectChanges();
    return { fixture, host: hostElement(fixture) };
  }

  it('shows the initials without a photo', () => {
    const { host } = render('Анна Смирнова', null);

    expect(host.textContent.trim()).toBe('АС');
    expect(host.classList).toContain('tb-avatar');
    expect(host.classList).not.toContain('tb-avatar--photo');
    expect(host.getAttribute('aria-hidden')).toBe('true');
    expect(host.hasAttribute('data-tb-label')).toBe(false);
  });

  it('takes the colour of the student or the group', () => {
    const { fixture, host } = render('Анна', null);

    fixture.componentRef.setInput('color', 'CYAN');
    fixture.detectChanges();

    expect(host.getAttribute('data-tb-label')).toBe('cyan');
  });

  it('shows the photo and falls back to the initials when it does not load', () => {
    const { fixture, host } = render('Анна', '/api/public/avatars/a', '6rem');

    const image = host.querySelector('img');
    expect(image?.getAttribute('src')).toBe('/api/public/avatars/a');
    expect(host.classList).toContain('tb-avatar--photo');
    expect(host.style.width).toBe('6rem');
    expect(host.style.fontSize).toBe('calc(2.4rem)');

    image?.dispatchEvent(new Event('error'));
    fixture.detectChanges();
    expect(host.querySelector('img')).toBeNull();
    expect(host.textContent.trim()).toBe('А');

    fixture.componentRef.setInput('photo', '/api/public/avatars/b');
    fixture.detectChanges();
    expect(host.querySelector('img')?.getAttribute('src')).toBe('/api/public/avatars/b');
  });
});
