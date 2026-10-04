import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl } from '@angular/forms';
import { providePrimeNG } from 'primeng/config';
import { buttonByText, hostElement, readableText, requireElement, typeInto } from '@testing/dom';
import { PortalAddressField } from './portal-address-field';
import { portalAddressValidator } from './portal-address';

describe('PortalAddressField', () => {
  let fixture: ComponentFixture<PortalAddressField>;
  let control: FormControl<string>;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [PortalAddressField],
      providers: [providePrimeNG()],
    });
    control = new FormControl('', { nonNullable: true, validators: [portalAddressValidator] });
    fixture = TestBed.createComponent(PortalAddressField);
    fixture.componentRef.setInput('control', control);
    await fixture.whenStable();
  });

  afterEach(() => {
    fixture.destroy();
  });

  it('explains what the address is for and fills in the address of the browser', async () => {
    const host = hostElement(fixture);
    expect(readableText(host)).toContain('С него начинаются ссылки-приглашения');

    buttonByText(host, 'Как в браузере').click();
    await fixture.whenStable();

    expect(control.value).toBe(window.location.origin);
    expect(control.dirty).toBe(true);
    expect(readableText(host)).toContain('Этот адрес открывается только на компьютере');
  });

  it('warns while typing and shows a wrong address after leaving the field', async () => {
    const host = hostElement(fixture);
    const input = requireElement(host, '#portal-address', HTMLInputElement);

    typeInto(input, 'http://192.168.1.10:8080');
    await fixture.whenStable();
    expect(readableText(host)).toContain('Это адрес домашней сети');
    expect(readableText(host)).toContain('Сейчас портал открыт по адресу');

    typeInto(input, 'https://school.example.com/portal');
    input.dispatchEvent(new Event('blur'));
    await fixture.whenStable();
    expect(readableText(host)).toContain('без пути после адреса');
    expect(readableText(host)).not.toContain('домашней сети');
  });

  it('follows a replaced control', async () => {
    const other = new FormControl('http://nas.local', { nonNullable: true });
    fixture.componentRef.setInput('control', other);
    await fixture.whenStable();

    expect(readableText(hostElement(fixture))).toContain('Это адрес домашней сети');
  });

  it('is read-only when the server sets the address', async () => {
    control.setValue('https://school.example.com');
    fixture.componentRef.setInput('fromEnvironment', true);
    await fixture.whenStable();

    const host = hostElement(fixture);
    expect(requireElement(host, '#portal-address', HTMLInputElement).readOnly).toBe(true);
    expect(readableText(host)).toContain('попросите администратора');
    expect(host.querySelector('p-button')).toBeNull();
  });
});
