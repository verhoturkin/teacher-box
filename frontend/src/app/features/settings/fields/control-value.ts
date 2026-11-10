import { Signal, effect, signal } from '@angular/core';
import { AbstractControl } from '@angular/forms';

/**
 * The value of the control an input gives, as a signal that follows its changes (in an injection context).
 */
export function controlValue<V>(control: () => AbstractControl<V>): Signal<V | undefined> {
  const value = signal<V | undefined>(undefined);
  effect((onCleanup) => {
    const current = control();
    value.set(current.value);
    const subscription = current.valueChanges.subscribe((changed) => {
      value.set(changed);
    });
    onCleanup(() => {
      subscription.unsubscribe();
    });
  });
  return value;
}
