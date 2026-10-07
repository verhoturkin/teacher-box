import { TestBed } from '@angular/core/testing';
import { Portal } from '@core/portal/portal';
import { testProviders } from '@testing/setup';
import { accentScheme } from './portal-accent';
import { MANIFEST_PATH, SystemBars } from './system-bars';
import { ThemeMode } from './theme-mode';

describe('SystemBars', () => {
  afterEach(() => {
    document.head
      .querySelectorAll('meta[name="theme-color"], link[rel="manifest"]')
      .forEach((node) => {
        node.remove();
      });
    TestBed.inject(ThemeMode).choose('system');
    TestBed.inject(Portal).set({
      name: 'Teacher Box',
      address: null,
      accent: 'indigo',
      logo: null,
    });
  });

  function meta(): string | null {
    return document.head.querySelector('meta[name="theme-color"]')?.getAttribute('content') ?? null;
  }

  function manifest(): string | null {
    return document.head.querySelector('link[rel="manifest"]')?.getAttribute('href') ?? null;
  }

  it('paints the system bars in the color of the top bar of the current theme and portal color', () => {
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
    expect(manifest()).toContain(encodeURIComponent(indigo.dark.surfaceContainer));

    TestBed.inject(Portal).set({ name: 'Портал', address: null, accent: 'emerald', logo: null });
    TestBed.tick();
    expect(meta()).toBe(accentScheme('emerald').dark.surface);
  });
});
