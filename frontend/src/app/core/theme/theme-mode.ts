import { DOCUMENT } from '@angular/common';
import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { readDeviceSetting, writeDeviceSetting } from '@shared/storage/device-settings';

/** How the portal looks: light, dark or as the operating system says. */
export type ThemeChoice = 'light' | 'dark' | 'system';

/** Device setting with the choice. */
export const THEME_KEY = 'tb.theme';
/** The class on `<html>` that switches PrimeNG and the portal to the dark theme. */
export const DARK_CLASS = 'tb-dark';

const DARK_QUERY = '(prefers-color-scheme: dark)';

function isChoice(value: string | null): value is ThemeChoice {
  return value === 'light' || value === 'dark' || value === 'system';
}

/**
 * The theme of the portal (ADR-0015): the user's choice on this device is stronger than the system
 * setting; «as in the system» follows it while the page is open.
 */
@Injectable({ providedIn: 'root' })
export class ThemeMode {
  private readonly document = inject(DOCUMENT);
  private readonly media = this.document.defaultView?.matchMedia(DARK_QUERY) ?? null;
  private readonly systemDark = signal(this.media?.matches ?? false);

  readonly choice = signal<ThemeChoice>(this.stored());
  readonly dark = computed(
    () => this.choice() === 'dark' || (this.choice() === 'system' && this.systemDark()),
  );

  constructor() {
    const listener = (event: MediaQueryListEvent): void => {
      this.systemDark.set(event.matches);
      this.apply();
    };
    this.media?.addEventListener('change', listener);
    inject(DestroyRef).onDestroy(() => {
      this.media?.removeEventListener('change', listener);
    });
  }

  choose(choice: ThemeChoice): void {
    this.choice.set(choice);
    writeDeviceSetting(THEME_KEY, choice);
    this.apply();
  }

  /** Puts the class of the current theme on `<html>`. */
  apply(): void {
    this.document.documentElement.classList.toggle(DARK_CLASS, this.dark());
  }

  private stored(): ThemeChoice {
    const value = readDeviceSetting(THEME_KEY);
    return isChoice(value) ? value : 'system';
  }
}
