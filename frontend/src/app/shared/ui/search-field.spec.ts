import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { hostElement } from '@testing/dom';
import { testProviders } from '@testing/setup';
import { SearchField } from './search-field';

@Component({
  imports: [SearchField, ReactiveFormsModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <tb-search-field [formControl]="search" label="Поиск досок" placeholder="Название или ученик" />
    <tb-search-field
      class="model"
      label="Поиск"
      [ngModel]="query()"
      (ngModelChange)="query.set($event)"
    />
  `,
})
class Host {
  readonly search = new FormControl('', { nonNullable: true });
  readonly query = signal('');
}

describe('SearchField', () => {
  async function render(): Promise<{
    host: HTMLElement;
    component: Host;
    detect: () => Promise<void>;
  }> {
    TestBed.configureTestingModule({ imports: [Host], providers: testProviders() });
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    return {
      host: hostElement(fixture),
      component: fixture.componentInstance,
      detect: async () => {
        fixture.detectChanges();
        await fixture.whenStable();
      },
    };
  }

  it('is a search bar with «Очистить поиск» only while there is text', async () => {
    const { host, component, detect } = await render();
    const input = host.querySelector<HTMLInputElement>('tb-search-field input');
    expect(input?.getAttribute('aria-label')).toBe('Поиск досок');
    expect(input?.placeholder).toBe('Название или ученик');
    expect(host.querySelector('.tb-search-field__clear')).toBeNull();

    if (input === null) {
      throw new Error('no input');
    }
    input.value = 'алг';
    input.dispatchEvent(new Event('input'));
    await detect();
    expect(component.search.value).toBe('алг');
    const clear = host.querySelector<HTMLButtonElement>('.tb-search-field__clear');
    expect(clear?.getAttribute('aria-label')).toBe('Очистить поиск');

    clear?.click();
    await detect();
    expect(component.search.value).toBe('');
    expect(input.value).toBe('');
    expect(document.activeElement).toBe(input);
    expect(host.querySelector('.tb-search-field__clear')).toBeNull();
  });

  it('clears on Esc, follows the form control and works with ngModel', async () => {
    const { host, component, detect } = await render();
    component.search.setValue('огэ');
    await detect();
    const input = host.querySelector<HTMLInputElement>('tb-search-field input');
    expect(input?.value).toBe('огэ');

    const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
    input?.dispatchEvent(escape);
    await detect();
    expect(component.search.value).toBe('');
    // an empty field leaves Esc to the page (a dialog closes)
    const again = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    const bubbled = vi.fn();
    host.addEventListener('keydown', bubbled);
    input?.dispatchEvent(again);
    expect(bubbled).toHaveBeenCalled();

    component.search.disable();
    await detect();
    expect(input?.disabled).toBe(true);

    const model = host.querySelector<HTMLInputElement>('tb-search-field.model input');
    if (model === null) {
      throw new Error('no input');
    }
    model.value = 'дроби';
    model.dispatchEvent(new Event('input'));
    model.dispatchEvent(new Event('blur'));
    await detect();
    expect(component.query()).toBe('дроби');
  });
});
