import { checkAddress } from './portal-address-check';

/** An image that loads or fails as soon as its address is set, or never. */
function fakeImage(outcome: 'load' | 'error' | 'never'): string[] {
  const sources: string[] = [];
  class FakeImage {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    set src(value: string) {
      sources.push(value);
      if (value === '' || outcome === 'never') {
        return;
      }
      queueMicrotask(() => {
        (outcome === 'load' ? this.onload : this.onerror)?.();
      });
    }
  }
  vi.stubGlobal('Image', FakeImage);
  return sources;
}

describe('checkAddress', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('opens at the address the page is open at and fails for no address', async () => {
    expect(await checkAddress('https://school.example.com/', 'https://school.example.com')).toBe(
      'opens',
    );
    expect(await checkAddress('school', 'https://school.example.com')).toBe('fails');
  });

  it('loads the app icon from another address', async () => {
    const sources = fakeImage('load');
    expect(await checkAddress('https://school.example.com', 'http://localhost:4200')).toBe('opens');
    expect(sources[0]).toMatch(/^https:\/\/school\.example\.com\/icons\/icon-192\.png\?check=\d+$/);

    fakeImage('error');
    expect(await checkAddress('https://school.example.com', 'http://localhost:4200')).toBe('fails');
  });

  it('fails when the address does not answer in time', async () => {
    vi.useFakeTimers();
    fakeImage('never');
    const result = checkAddress('https://school.example.com', 'http://localhost:4200', 100);
    vi.advanceTimersByTime(100);
    expect(await result).toBe('fails');
  });
});
