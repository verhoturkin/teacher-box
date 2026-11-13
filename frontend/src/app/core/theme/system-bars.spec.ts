import { TestBed } from '@angular/core/testing';
import { Portal } from '@core/portal/portal';
import { testProviders } from '@testing/setup';
import { accentScheme } from './accent-scheme';
import { MANIFEST_PATH, SystemBars } from './system-bars';
import { ThemeMode } from './theme-mode';

describe('SystemBars', () => {
  function clearHead(): void {
    document.head
      .querySelectorAll('meta[name="theme-color"], link[rel="manifest"]')
      .forEach((node) => {
        node.remove();
      });
  }

  beforeEach(clearHead);

  afterEach(() => {
    TestBed.inject(ThemeMode).choose('system');
    TestBed.inject(Portal).set({
      name: 'Teacher Box',
      address: null,
      accent: 'indigo',
      logo: null,
    });
    TestBed.resetTestingModule();
    clearHead();
  });

  function meta(): string | null {
    return document.head.querySelector('meta[name="theme-color"]')?.getAttribute('content') ?? null;
  }

  function manifest(): string | null {
    return document.head.querySelector('link[rel="manifest"]')?.getAttribute('href') ?? null;
  }

  it('paints the system bars in the color of the top bar of the current theme and portal color', async () => {
    TestBed.configureTestingModule({ providers: testProviders() });
    const existing = document.createElement('meta');
    existing.name = 'theme-color';
    document.head.appendChild(existing);
    const theme = TestBed.inject(ThemeMode);
    theme.choose('light');
    TestBed.inject(SystemBars);
    TestBed.tick();

    const indigo = accentScheme('indigo');
    expect(meta()).toBe(indigo.light.surfaceContainer);
    expect(document.head.querySelectorAll('meta[name="theme-color"]')).toHaveLength(1);
    const query = new URLSearchParams({
      theme: indigo.light.surfaceContainer,
      background: indigo.light.surfaceContainer,
    });
    expect(manifest()).toBe(`${MANIFEST_PATH}?${query.toString()}`);

    theme.choose('dark');
    TestBed.tick();
    expect(meta()).toBe(indigo.dark.surface);
    // the installed app's navigation bar takes the bottom navigation's color, not the top bar's
    expect(manifest()).toBe(
      `${MANIFEST_PATH}?${new URLSearchParams({
        theme: indigo.dark.surfaceContainer,
        background: indigo.dark.surfaceContainer,
      }).toString()}`,
    );

    const portal = TestBed.inject(Portal);
    portal.set({ name: 'Портал', address: null, accent: 'emerald', logo: null });
    await portal.painted();
    TestBed.tick();
    expect(meta()).toBe(accentScheme('emerald').dark.surface);
  });
});
