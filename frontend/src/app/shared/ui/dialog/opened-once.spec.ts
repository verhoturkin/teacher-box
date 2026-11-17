import { signal } from '@angular/core';
import { openedOnce } from './opened-once';

describe('openedOnce', () => {
  it('is false until the dialog opens, then stays true', () => {
    const visible = signal(false);
    const built = openedOnce(visible);
    expect(built()).toBe(false);

    visible.set(true);
    expect(built()).toBe(true);

    visible.set(false);
    expect(built()).toBe(true);
  });
});
