import { DOCUMENT } from '@angular/common';
import { DestroyRef, Injectable, inject } from '@angular/core';

/** Keep autofocus and focus restoration, but show focus rings only after keyboard interaction. */
@Injectable({ providedIn: 'root' })
export class KeyboardFocus {
  private readonly document = inject(DOCUMENT);
  private readonly destroy = inject(DestroyRef);
  private started = false;

  start(): void {
    if (this.started) {
      return;
    }
    this.started = true;
    const root = this.document.documentElement;
    const keyboard = (event: KeyboardEvent): void => {
      if (!['Shift', 'Control', 'Alt', 'Meta'].includes(event.key)) {
        root.classList.add('tb-keyboard-focus');
      }
    };
    const pointer = (): void => {
      root.classList.remove('tb-keyboard-focus');
    };
    root.classList.remove('tb-keyboard-focus');
    this.document.addEventListener('keydown', keyboard, true);
    this.document.addEventListener('pointerdown', pointer, true);
    this.destroy.onDestroy(() => {
      this.document.removeEventListener('keydown', keyboard, true);
      this.document.removeEventListener('pointerdown', pointer, true);
      root.classList.remove('tb-keyboard-focus');
    });
  }
}
