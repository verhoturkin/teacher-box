import { DOCUMENT } from '@angular/common';
import { Injectable, computed, effect, inject } from '@angular/core';
import { Portal } from '@core/portal/portal';
import { ThemeMode } from './theme-mode';

/** The manifest of the installed portal (served by the backend with the portal's name and logo). */
export const MANIFEST_PATH = '/api/public/portal/manifest.webmanifest';

/**
 * The system bars of a phone take the color of the top bar (ADR-0034): `<meta name="theme-color">` for the
 * browser and the status bar, the manifest's colors for the installed app (Chrome paints the navigation bar
 * with its `theme_color`). Both follow the theme and the portal color while the page is open.
 */
@Injectable({ providedIn: 'root' })
export class SystemBars {
  private readonly document = inject(DOCUMENT);
  private readonly theme = inject(ThemeMode);
  private readonly portal = inject(Portal);

  /** The top bar: surface-container in the light theme, surface in the dark one (`shell.scss`). */
  readonly color = computed(() => {
    const scheme = this.portal.scheme();
    return this.theme.dark() ? scheme.dark.surface : scheme.light.surfaceContainer;
  });
  /** The page behind the content: the splash screen of the installed app. */
  readonly background = computed(() => {
    const scheme = this.portal.scheme();
    return (this.theme.dark() ? scheme.dark : scheme.light).surfaceContainer;
  });

  constructor() {
    effect(() => {
      this.element('meta', 'name', 'theme-color').setAttribute('content', this.color());
      const query = new URLSearchParams({ theme: this.color(), background: this.background() });
      this.element('link', 'rel', 'manifest').setAttribute('href', `${MANIFEST_PATH}?${query}`);
    });
  }

  /** The element of `<head>` with this attribute, created when the page has none. */
  private element(tag: 'meta' | 'link', attribute: string, value: string): HTMLElement {
    const head = this.document.head;
    const found = head.querySelector<HTMLElement>(`${tag}[${attribute}="${value}"]`);
    if (found !== null) return found;
    const created = this.document.createElement(tag);
    created.setAttribute(attribute, value);
    head.appendChild(created);
    return created;
  }
}
