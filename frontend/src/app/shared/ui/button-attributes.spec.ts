import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Button } from 'primeng/button';
import { hostElement, requireElement } from '@testing/dom';
import { ButtonAttributes } from './button-attributes';

@Component({
  imports: [Button, ButtonAttributes],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<p-button
    icon="pi pi-chevron-down"
    ariaLabel="Ещё"
    [tbAttributes]="{ 'aria-haspopup': 'menu', 'aria-expanded': expanded(), title: null }"
  />`,
})
class Host {
  readonly expanded = signal('false');
}

describe('ButtonAttributes', () => {
  it('puts attributes on the inner button and keeps them up to date', async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const button = requireElement(hostElement(fixture), 'p-button button', HTMLButtonElement);

    expect(button.getAttribute('aria-haspopup')).toBe('menu');
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(button.hasAttribute('title')).toBe(false);

    fixture.componentInstance.expanded.set('true');
    await fixture.whenStable();
    expect(button.getAttribute('aria-expanded')).toBe('true');
  });
});
