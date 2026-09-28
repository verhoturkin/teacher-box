import { TestBed } from '@angular/core/testing';
import { DARK_CLASS, THEME_KEY, ThemeMode } from './theme-mode';

/** The system setting «dark mode» that the test switches. */
class SystemScheme extends EventTarget implements MediaQueryList {
  matches = false;
  onchange: ((this: MediaQueryList, event: MediaQueryListEvent) => unknown) | null = null;

  constructor(readonly media: string) {
    super();
  }

  addListener(): void {
    // deprecated API
  }

  removeListener(): void {
    // deprecated API
  }

  change(dark: boolean): void {
    this.matches = dark;
    const event = new Event('change');
    Object.defineProperty(event, 'matches', { value: dark });
    this.dispatchEvent(event);
  }
}

describe('ThemeMode', () => {
  let system: SystemScheme;

  beforeEach(() => {
    system = new SystemScheme('(prefers-color-scheme: dark)');
    vi.spyOn(window, 'matchMedia').mockReturnValue(system);
  });

  afterEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove(DARK_CLASS);
    vi.restoreAllMocks();
  });

  function isDark(): boolean {
    return document.documentElement.classList.contains(DARK_CLASS);
  }

  it('follows the system until the user chooses', () => {
    system.matches = true;
    const theme = TestBed.inject(ThemeMode);
    theme.apply();

    expect(theme.choice()).toBe('system');
    expect(isDark()).toBe(true);

    system.change(false);
    expect(isDark()).toBe(false);
  });

  it('keeps the choice of the user on the device', () => {
    const theme = TestBed.inject(ThemeMode);

    theme.choose('dark');
    expect(isDark()).toBe(true);
    expect(localStorage.getItem(THEME_KEY)).toBe('dark');

    system.change(false);
    expect(isDark()).toBe(true);

    theme.choose('light');
    expect(isDark()).toBe(false);
  });

  it('reads the choice made before and ignores nonsense', () => {
    localStorage.setItem(THEME_KEY, 'dark');
    expect(TestBed.inject(ThemeMode).choice()).toBe('dark');

    TestBed.resetTestingModule();
    localStorage.setItem(THEME_KEY, 'purple');
    expect(TestBed.inject(ThemeMode).choice()).toBe('system');
  });
});
