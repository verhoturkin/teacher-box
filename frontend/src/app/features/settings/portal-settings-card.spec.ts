import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MessageService } from 'primeng/api';
import { Portal } from '@core/portal/portal';
import { buttonByText, hostElement, readableText, requireElement, typeInto } from '@testing/dom';
import { portalSettings } from '@testing/portal-fixtures';
import { PortalSettingsCard } from './portal-settings-card';
import { testProviders } from '@testing/setup';

describe('PortalSettingsCard', () => {
  let fixture: ComponentFixture<PortalSettingsCard>;
  let backend: HttpTestingController;

  async function render(settings = portalSettings()): Promise<HTMLElement> {
    TestBed.configureTestingModule({
      imports: [PortalSettingsCard],
      providers: testProviders(),
    });
    backend = TestBed.inject(HttpTestingController);
    vi.spyOn(TestBed.inject(MessageService), 'add');
    fixture = TestBed.createComponent(PortalSettingsCard);
    fixture.detectChanges();
    backend.expectOne('/api/teacher/portal').flush(settings);
    await fixture.whenStable();
    return hostElement(fixture);
  }

  afterEach(() => {
    backend.verify();
    fixture.destroy();
  });

  it('names the portal and sets its address', async () => {
    const host = await render();
    expect(requireElement(host, '#portal-name', HTMLInputElement).value).toBe('Teacher Box');

    typeInto(requireElement(host, '#portal-name', HTMLInputElement), 'Английский с Марией');
    typeInto(
      requireElement(host, '#portal-address', HTMLInputElement),
      'https://school.example.com',
    );
    buttonByText(host, 'Сохранить').click();

    const request = backend.expectOne({ method: 'PUT', url: '/api/teacher/portal' });
    expect(request.request.body).toEqual({
      name: 'Английский с Марией',
      address: 'https://school.example.com',
    });
    request.flush(
      portalSettings({ name: 'Английский с Марией', address: 'https://school.example.com' }),
    );
    await fixture.whenStable();

    const portal = TestBed.inject(Portal);
    expect(portal.name()).toBe('Английский с Марией');
    expect(portal.link('/cabinet')).toBe('https://school.example.com/cabinet');
    expect(TestBed.inject(MessageService).add).toHaveBeenCalled();
  });

  it('does not save a wrong address and survives a failed save', async () => {
    const host = await render();

    typeInto(requireElement(host, '#portal-address', HTMLInputElement), 'school.example.com');
    await fixture.whenStable();
    expect(buttonByText(host, 'Сохранить').disabled).toBe(true);
    fixture.componentInstance.save();

    typeInto(requireElement(host, '#portal-address', HTMLInputElement), '');
    fixture.componentInstance.save();
    backend
      .expectOne({ method: 'PUT', url: '/api/teacher/portal' })
      .flush(null, { status: 500, statusText: 'Error' });
    await fixture.whenStable();

    expect(buttonByText(host, 'Сохранить').disabled).toBe(false);
  });

  it('shows an address set on the server as read-only', async () => {
    const host = await render(
      portalSettings({ address: 'https://school.example.com', addressFromEnvironment: true }),
    );

    expect(requireElement(host, '#portal-address', HTMLInputElement).readOnly).toBe(true);
    expect(readableText(host)).toContain('TEACHERBOX_PUBLIC_URL');
  });
});
