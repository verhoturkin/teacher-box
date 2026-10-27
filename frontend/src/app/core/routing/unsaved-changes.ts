import { DestroyRef, Injectable, inject } from '@angular/core';

/**
 * The forms of the open page that hold changes not saved yet. A page with several cards (the settings)
 * asks `dirty()` before it is left; a card registers itself with `guardUnsaved`.
 */
@Injectable({ providedIn: 'root' })
export class UnsavedChanges {
  private readonly sources = new Set<() => boolean>();

  /** @returns the function that stops the watch */
  register(isDirty: () => boolean): () => void {
    this.sources.add(isDirty);
    return () => {
      this.sources.delete(isDirty);
    };
  }

  /** Whether some registered form holds changes not saved. */
  dirty(): boolean {
    return [...this.sources].some((isDirty) => isDirty());
  }
}

/**
 * Called in the injection context of a card with a form: while the card lives, its unsaved changes
 * stop a route change (the page asks `UnsavedChanges.dirty()`) and a reload (the browser's
 * `beforeunload` prompt).
 */
export function guardUnsaved(isDirty: () => boolean): void {
  const unregister = inject(UnsavedChanges).register(isDirty);
  const warn = (event: BeforeUnloadEvent): void => {
    if (isDirty()) {
      event.preventDefault();
    }
  };
  window.addEventListener('beforeunload', warn);
  inject(DestroyRef).onDestroy(() => {
    unregister();
    window.removeEventListener('beforeunload', warn);
  });
}
