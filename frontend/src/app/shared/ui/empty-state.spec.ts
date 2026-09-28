import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { hostElement, requireElement } from '@testing/dom';
import { EmptyState } from './empty-state';

@Component({
  imports: [EmptyState],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <tb-empty-state icon="pi-users" title="Учеников пока нет" hint="Добавьте первого">
      <button type="button">Добавить</button>
    </tb-empty-state>
    <tb-empty-state title="Пусто" />
  `,
})
class Host {}

describe('EmptyState', () => {
  it('shows the icon, what is missing, a hint and the first action', async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const [full, bare] = Array.from(hostElement(fixture).querySelectorAll('tb-empty-state'));

    expect(full?.querySelector('i')?.className).toContain('pi-users');
    expect(full?.querySelector('.tb-empty-state__title')?.textContent).toBe('Учеников пока нет');
    expect(full?.querySelector('.tb-empty-state__hint')?.textContent).toBe('Добавьте первого');
    expect(
      requireElement(hostElement(fixture), 'tb-empty-state button', HTMLButtonElement).textContent,
    ).toBe('Добавить');
    expect(bare?.querySelector('i')?.className).toContain('pi-inbox');
    expect(bare?.querySelector('.tb-empty-state__hint')).toBeNull();
  });
});
