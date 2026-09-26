/**
 * Global test environment setup (runs before every spec file).
 *
 * jsdom does not implement `window.matchMedia` and `ResizeObserver`, which PrimeNG components use for
 * responsive behaviour (e.g. scrollable tabs).
 */
class StaticMediaQueryList extends EventTarget implements MediaQueryList {
  readonly matches = false;
  onchange: ((this: MediaQueryList, event: MediaQueryListEvent) => unknown) | null = null;

  constructor(readonly media: string) {
    super();
  }

  addListener(): void {
    // deprecated API, nothing to listen to in a static environment
  }

  removeListener(): void {
    // deprecated API, nothing to listen to in a static environment
  }
}

if (typeof window.matchMedia !== 'function') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string): MediaQueryList => new StaticMediaQueryList(query),
  });
}

/** Nothing is ever resized in jsdom. */
class StaticResizeObserver implements ResizeObserver {
  observe(): void {
    // no layout in jsdom
  }

  unobserve(): void {
    // no layout in jsdom
  }

  disconnect(): void {
    // no layout in jsdom
  }
}

if (typeof window.ResizeObserver !== 'function') {
  Object.defineProperty(window, 'ResizeObserver', { writable: true, value: StaticResizeObserver });
}
