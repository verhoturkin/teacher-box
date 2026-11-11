import { ChangeDetectionStrategy, Component, DOCUMENT } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { StyleBundles, withStyleBundle } from './style-bundles';

@Component({ template: '', changeDetection: ChangeDetectionStrategy.OnPush })
class Screen {}

describe('StyleBundles', () => {
  const HREF = 'sample.css';

  function links(): HTMLLinkElement[] {
    return [
      ...TestBed.inject(DOCUMENT).head.querySelectorAll<HTMLLinkElement>(`link[href="${HREF}"]`),
    ];
  }

  /** jsdom does not fetch stylesheets: the test tells the link how it went. */
  function finish(event: 'load' | 'error'): void {
    links().forEach((link) => link.dispatchEvent(new Event(event)));
  }

  /** Goes to a route behind the bundle; resolves to whether the route opened. */
  function open(): Promise<boolean> {
    return TestBed.inject(Router).navigateByUrl('/screen');
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'screen', canActivate: [withStyleBundle(HREF)], component: Screen },
        ]),
      ],
    });
  });

  afterEach(() => {
    links().forEach((link) => {
      link.remove();
    });
  });

  it('adds a stylesheet once and waits for it', async () => {
    const bundles = TestBed.inject(StyleBundles);

    const first = bundles.load(HREF);
    const second = bundles.load(HREF);
    expect(links()).toHaveLength(1);
    expect(links()[0]?.rel).toBe('stylesheet');
    finish('load');

    await expect(first).resolves.toBeUndefined();
    await expect(second).resolves.toBeUndefined();
    await bundles.load(HREF);
    expect(links()).toHaveLength(1);
  });

  it('adds the stylesheet again when it did not load', async () => {
    const bundles = TestBed.inject(StyleBundles);

    const failed = bundles.load(HREF);
    finish('error');
    await expect(failed).rejects.toThrow('sample.css did not load');
    expect(links()).toHaveLength(0);

    const retried = bundles.load(HREF);
    expect(links()).toHaveLength(1);
    finish('load');
    await expect(retried).resolves.toBeUndefined();
  });

  it('opens the route when the bundle is there', async () => {
    const result = open();
    await vi.waitFor(() => {
      expect(links()).toHaveLength(1);
    });
    finish('load');

    await expect(result).resolves.toBe(true);
  });

  it('opens the route without the bundle too', async () => {
    const result = open();
    await vi.waitFor(() => {
      expect(links()).toHaveLength(1);
    });
    finish('error');

    await expect(result).resolves.toBe(true);
    expect(links()).toHaveLength(0);
  });
});
