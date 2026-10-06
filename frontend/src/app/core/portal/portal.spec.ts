import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { MessageService } from 'primeng/api';
import { apiErrorInterceptor } from '@core/http/api-error.interceptor';
import { DEFAULT_PORTAL_NAME, Portal } from './portal';
import { portalInfo } from '@testing/portal-fixtures';

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

  afterEach(() => {
    backend.verify();
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
