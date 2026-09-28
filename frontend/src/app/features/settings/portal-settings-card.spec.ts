import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MessageService } from 'primeng/api';
import { Portal } from '@core/portal/portal';
import { buttonByText, hostElement, readableText, requireElement, typeInto } from '@testing/dom';
import { portalSettings } from '@testing/portal-fixtures';
import { PortalSettingsCard } from './portal-settings-card';
import { testProviders } from '@testing/setup';

/** A FileList with the given files (jsdom cannot build one). */
class TestFiles extends Array<File> implements FileList {
  item(index: number): File | null {
    return this[index] ?? null;
  }
}

function listOf(...files: File[]): FileList {
  const list = new TestFiles();
  list.push(...files);
  return list;
}

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
      accent: 'indigo',
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

  it('saves the chosen color', async () => {
    const host = await render();

    requireElement(host, 'button[aria-label="Изумрудный"]', HTMLButtonElement).click();
    await fixture.whenStable();
    expect(
      requireElement(host, 'button[aria-label="Изумрудный"]', HTMLButtonElement).getAttribute(
        'aria-checked',
      ),
    ).toBe('true');
    buttonByText(host, 'Сохранить').click();

    const request = backend.expectOne({ method: 'PUT', url: '/api/teacher/portal' });
    expect(request.request.body).toEqual(expect.objectContaining({ accent: 'emerald' }));
    request.flush(portalSettings({ accent: 'emerald' }));
  });

  it('picks an own color and warns when buttons would be poorly readable', async () => {
    const host = await render();
    const own = (): HTMLButtonElement =>
      requireElement(host, 'button[aria-label="Свой цвет"]', HTMLButtonElement);

    own().click();
    await fixture.whenStable();
    expect(own().getAttribute('aria-checked')).toBe('true');
    const field = requireElement(host, '#portal-own-color', HTMLInputElement);
    expect(field.value).toBe('#0f766e');
    expect(readableText(host)).not.toContain('будет плохо читаться');

    typeInto(field, '#FDE68A');
    await fixture.whenStable();
    expect(readableText(host)).toContain(
      'будет плохо читаться в светлой теме — выберите цвет темнее',
    );
    typeInto(field, '#1e1b4b');
    await fixture.whenStable();
    expect(readableText(host)).toContain('в тёмной теме — выберите цвет светлее');
    typeInto(field, '#1e1b4');
    await fixture.whenStable();
    expect(fixture.componentInstance.ownColor.value).toBe('#1e1b4');

    buttonByText(host, 'Сохранить').click();
    const request = backend.expectOne({ method: 'PUT', url: '/api/teacher/portal' });
    expect(request.request.body).toEqual(expect.objectContaining({ accent: '#1e1b4b' }));
    request.flush(portalSettings({ accent: '#1e1b4b' }));
    await fixture.whenStable();

    requireElement(host, 'button[aria-label="Индиго"]', HTMLButtonElement).click();
    await fixture.whenStable();
    expect(host.querySelector('#portal-own-color')).toBeNull();
    own().click();
    await fixture.whenStable();
    expect(requireElement(host, '#portal-own-color', HTMLInputElement).value).toBe('#1e1b4b');
  });

  it('shows a saved own color', async () => {
    const host = await render(portalSettings({ accent: '#b91c1c' }));

    expect(
      requireElement(host, 'button[aria-label="Свой цвет"]', HTMLButtonElement).getAttribute(
        'aria-checked',
      ),
    ).toBe('true');
    expect(requireElement(host, '#portal-own-color', HTMLInputElement).value).toBe('#b91c1c');
  });

  it('uploads and removes the logo', async () => {
    const host = await render();
    const input = requireElement(host, 'input[type="file"]', HTMLInputElement);

    fixture.componentInstance.uploadLogo(input);
    const logo = new File(['<svg/>'], 'logo.svg', { type: 'image/svg+xml' });
    Object.defineProperty(input, 'files', { value: listOf(logo), configurable: true });
    input.dispatchEvent(new Event('change'));
    const upload = backend.expectOne({ method: 'PUT', url: '/api/teacher/portal/logo' });
    expect(upload.request.body).toBeInstanceOf(FormData);
    upload.flush(portalSettings({ logo: '/api/public/portal/logo?v=1' }));
    await fixture.whenStable();
    expect(TestBed.inject(Portal).logo()).toBe('/api/public/portal/logo?v=1');
    expect(requireElement(host, 'tb-portal-logo img', HTMLImageElement).getAttribute('src')).toBe(
      '/api/public/portal/logo?v=1',
    );

    buttonByText(host, 'Убрать').click();
    backend
      .expectOne({ method: 'DELETE', url: '/api/teacher/portal/logo' })
      .flush(portalSettings());
    await fixture.whenStable();
    expect(TestBed.inject(Portal).logo()).toBeNull();
    expect(host.textContent).not.toContain('Убрать');
  });

  it('refuses a logo over 1 MB and survives a failed upload', async () => {
    const host = await render();
    const input = requireElement(host, 'input[type="file"]', HTMLInputElement);
    const large = new File([new Uint8Array(1024 * 1024 + 1)], 'big.png', { type: 'image/png' });
    Object.defineProperty(input, 'files', { value: listOf(large), configurable: true });

    fixture.componentInstance.uploadLogo(input);
    expect(TestBed.inject(MessageService).add).toHaveBeenCalledWith(
      expect.objectContaining({ detail: 'Файл больше 1 МБ' }),
    );

    Object.defineProperty(input, 'files', {
      value: listOf(new File(['x'], 'x.png')),
      configurable: true,
    });
    fixture.componentInstance.uploadLogo(input);
    backend
      .expectOne('/api/teacher/portal/logo')
      .flush(null, { status: 422, statusText: 'Unprocessable Content' });
    await fixture.whenStable();
    expect(buttonByText(host, 'Загрузить логотип').disabled).toBe(false);
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
