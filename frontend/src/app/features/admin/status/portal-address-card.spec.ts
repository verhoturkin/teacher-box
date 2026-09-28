import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Portal } from '@core/portal/portal';
import { buttonByText, hostElement, readableText, requireElement, typeInto } from '@testing/dom';
import { portalSettings } from '@testing/portal-fixtures';
import { PortalAddressCard } from './portal-address-card';
import { testProviders } from '@testing/setup';

describe('PortalAddressCard', () => {
  let fixture: ComponentFixture<PortalAddressCard>;
  let backend: HttpTestingController;

  async function render(settings = portalSettings()): Promise<HTMLElement> {
    TestBed.configureTestingModule({
      imports: [PortalAddressCard],
      providers: testProviders(),
    });
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(PortalAddressCard);
    fixture.detectChanges();
    backend.expectOne('/api/admin/portal').flush(settings);
    await fixture.whenStable();
    return hostElement(fixture);
  }

  afterEach(() => {
    backend.verify();
    fixture.destroy();
  });

  it('changes the address of the portal', async () => {
    const host = await render();

    typeInto(
      requireElement(host, '#portal-address', HTMLInputElement),
      'https://school.example.com/',
    );
    buttonByText(host, 'Сохранить адрес').click();
    const request = backend.expectOne({ method: 'PUT', url: '/api/admin/portal' });
    expect(request.request.body).toEqual({ address: 'https://school.example.com/' });
    request.flush(portalSettings({ address: 'https://school.example.com' }));
    await fixture.whenStable();

    expect(requireElement(host, '#portal-address', HTMLInputElement).value).toBe(
      'https://school.example.com',
    );
    expect(TestBed.inject(Portal).link('/admin')).toBe('https://school.example.com/admin');
  });

  it('keeps a wrong address and a failed save in the form', async () => {
    const host = await render();

    typeInto(requireElement(host, '#portal-address', HTMLInputElement), 'nas');
    fixture.componentInstance.save();
    typeInto(requireElement(host, '#portal-address', HTMLInputElement), 'http://nas');
    fixture.componentInstance.save();
    backend
      .expectOne({ method: 'PUT', url: '/api/admin/portal' })
      .flush(null, { status: 500, statusText: 'Error' });
    await fixture.whenStable();

    expect(requireElement(host, '#portal-address', HTMLInputElement).value).toBe('http://nas');
    expect(buttonByText(host, 'Сохранить адрес').disabled).toBe(false);
  });

  it('only shows an address set on the server', async () => {
    const host = await render(
      portalSettings({ address: 'https://school.example.com', addressFromEnvironment: true }),
    );

    expect(readableText(host)).toContain('TEACHERBOX_PUBLIC_URL');
    expect(host.querySelector('button[type="submit"]')).toBeNull();
  });
});
