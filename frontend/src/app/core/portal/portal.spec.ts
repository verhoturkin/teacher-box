import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { MessageService } from 'primeng/api';
import { apiErrorInterceptor } from '@core/http/api-error.interceptor';
import { DEFAULT_PORTAL_NAME, Portal } from './portal';
import { portalInfo } from '@testing/portal-fixtures';
import { accentScheme } from '@core/theme/accent-scheme';
import { SCHEME_KEY, loadAccentScheme } from '@core/theme/portal-accent';
import { DEFAULT_SCHEME } from '@core/theme/teacher-box-preset';

describe('Portal', () => {
  let portal: Portal;
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiErrorInterceptor])),
        provideHttpClientTesting(),
        MessageService,
      ],
    });
    portal = TestBed.inject(Portal);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(async () => {
    backend.verify();
    portal.set(portalInfo());
    await portal.painted();
    localStorage.removeItem(SCHEME_KEY);
  });

  it('starts in the default scheme and repaints at once when the roles are known', () => {
    expect(portal.scheme()).toBe(DEFAULT_SCHEME);

    portal.set(portalInfo({ accent: 'emerald' }));
    portal.set(portalInfo());

    // the default appearance is a constant: nothing to wait for
    expect(portal.scheme().light).toBe(DEFAULT_SCHEME.light);
  });

  it('recomputes the theme when only scheme or contrast changes', async () => {
    portal.set(portalInfo({ scheme: 'tonal-spot', contrast: 'standard' }));
    await portal.painted();
    const standard = portal.scheme();
    expect(standard).not.toBe(DEFAULT_SCHEME);

    portal.set(portalInfo({ scheme: 'tonal-spot', contrast: 'maximum' }));
    await portal.painted();

    expect(portal.scheme()).not.toBe(standard);
    expect(portal.scheme().light.primary).not.toBe(standard.light.primary);
  });

  it('starts in the colors of the portal: loading waits until they are computed', async () => {
    const loaded = portal.load();
    backend
      .expectOne('/api/public/portal')
      .flush(portalInfo({ accent: '#bb2649', scheme: 'vibrant', contrast: 'increased' }));
    await loaded;

    expect(portal.scheme()).toEqual(
      accentScheme('#bb2649', { scheme: 'vibrant', contrast: 'increased' }),
    );
  });

  it('paints the last color when two are computed at once', async () => {
    portal.set(portalInfo({ accent: 'emerald' }));
    portal.set(portalInfo({ accent: 'pink' }));
    await portal.painted();
    await loadAccentScheme('emerald');

    expect(portal.scheme().primary).toEqual(accentScheme('pink').primary);
    expect(portal.scheme().light).toEqual(accentScheme('pink').light);
  });

  it('builds links from the address the page is opened at until the address is set', () => {
    expect(portal.name()).toBe(DEFAULT_PORTAL_NAME);
    expect(portal.addressSet()).toBe(false);
    expect(portal.link('/invite/x')).toBe(`${window.location.origin}/invite/x`);
    expect(portal.openedAt()).toBe(window.location.origin);
  });

  it('loads the name and the address', async () => {
    const loaded = portal.load();
    backend
      .expectOne('/api/public/portal')
      .flush(portalInfo({ name: 'Школа', address: 'https://school.example.com' }));
    await loaded;

    expect(portal.name()).toBe('Школа');
    expect(portal.addressSet()).toBe(true);
    expect(portal.link('/cabinet')).toBe('https://school.example.com/cabinet');
  });

  it('shows the logo in the browser tab in place of every default icon', () => {
    const icon = document.createElement('link');
    icon.rel = 'icon';
    icon.href = 'favicon.ico';
    const svg = document.createElement('link');
    svg.rel = 'icon';
    svg.type = 'image/svg+xml';
    svg.href = 'favicon.svg';
    document.head.append(icon, svg);

    portal.set(portalInfo({ logo: '/api/public/portal/logo?v=1', accent: 'emerald' }));
    expect(icon.getAttribute('href')).toBe('/api/public/portal/logo?v=1');
    expect(svg.getAttribute('href')).toBe('/api/public/portal/logo?v=1');
    expect(svg.type).toBe('');
    expect(portal.logo()).toBe('/api/public/portal/logo?v=1');

    portal.set(portalInfo());
    expect(icon.getAttribute('href')).toBe('favicon.ico');
    expect(svg.getAttribute('href')).toBe('favicon.svg');
    expect(svg.type).toBe('image/svg+xml');
    icon.remove();
    svg.remove();
    portal.set(portalInfo({ logo: '/other' }));
  });

  it('keeps the defaults quietly when the server does not answer', async () => {
    const toast = vi.spyOn(TestBed.inject(MessageService), 'add');

    const loaded = portal.load();
    backend.expectOne('/api/public/portal').flush(null, { status: 503, statusText: 'Unavailable' });
    await loaded;

    expect(portal.name()).toBe(DEFAULT_PORTAL_NAME);
    expect(toast).not.toHaveBeenCalled();
  });
});
