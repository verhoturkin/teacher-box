import { TestBed } from '@angular/core/testing';
import { KeyboardFocus } from './keyboard-focus';

describe('KeyboardFocus', () => {
  const active = (): boolean => document.documentElement.classList.contains('tb-keyboard-focus');
  const key = (value: string): void => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: value }));
  };

  it('leaves programmatic autofocus available without a ring on opening', () => {
    TestBed.inject(KeyboardFocus).start();
    const button = document.createElement('button');
    document.body.append(button);
    button.focus();
    expect(document.activeElement).toBe(button);
    expect(active()).toBe(false);
    button.remove();
  });

  it('shows rings for keyboard use and hides them for pointer use', () => {
    const service = TestBed.inject(KeyboardFocus);
    service.start();
    service.start();
    key('Tab');
    expect(active()).toBe(true);
    document.dispatchEvent(new Event('pointerdown'));
    expect(active()).toBe(false);
    key('ArrowDown');
    expect(active()).toBe(true);
  });

  it('ignores modifier keys on their own', () => {
    TestBed.inject(KeyboardFocus).start();
    for (const modifier of ['Shift', 'Control', 'Alt', 'Meta']) {
      key(modifier);
      expect(active()).toBe(false);
    }
  });

  it('removes the listeners and state when the application is destroyed', () => {
    TestBed.inject(KeyboardFocus).start();
    key('Tab');
    TestBed.resetTestingModule();
    expect(active()).toBe(false);
    key('Tab');
    expect(active()).toBe(false);
  });
});
