import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { buttonByText, hostElement, readableText, requireElement } from '@testing/dom';
import { DefaultPriceCard } from './default-price-card';
import { testProviders } from '@testing/setup';

describe('DefaultPriceCard', () => {
  let fixture: ComponentFixture<DefaultPriceCard>;
  let backend: HttpTestingController;
  let changed: number[];

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [DefaultPriceCard],
      providers: testProviders(),
    });
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(DefaultPriceCard);
    fixture.componentRef.setInput('price', 150_000);
    fixture.componentRef.setInput('currency', 'RUB');
    changed = [];
    fixture.componentInstance.changed.subscribe((price) => changed.push(price));
    await fixture.whenStable();
  });

  afterEach(() => {
    backend.verify();
    fixture.destroy();
  });

  function button(label: string): HTMLButtonElement {
    const found = hostElement(fixture).querySelector<HTMLButtonElement>(
      `button[aria-label="${label}"]`,
    );
    if (found === null) {
      throw new Error(`No button ${label}`);
    }
    return found;
  }

  it('changes the price of new students in place', async () => {
    expect(readableText(hostElement(fixture))).toContain('1 500 ₽');

    button('Изменить цену для новых учеников').click();
    await fixture.whenStable();
    const host = hostElement(fixture);
    // the field under its label across the card, the buttons under it (ADR-0018)
    expect(requireElement(host, '.tb-field > label', HTMLLabelElement).htmlFor).toBe(
      'default-price',
    );
    expect(readableText(host)).toContain('Цена каждого ученика меняется в его строке');
    fixture.componentInstance.form.setValue({ price: 1800 });
    buttonByText(host, 'Сохранить').click();

    const request = backend.expectOne({ method: 'PUT', url: '/api/teacher/billing/default-price' });
    expect(request.request.body).toEqual({ lessonPrice: 180_000 });
    request.flush({ lessonPrice: 180_000 });
    await fixture.whenStable();

    expect(changed).toEqual([180_000]);
    expect(hostElement(fixture).querySelector('form')).toBeNull();
  });

  it('keeps the editor open when saving fails and can be cancelled', async () => {
    fixture.componentInstance.edit();
    await fixture.whenStable();
    fixture.componentInstance.form.setValue({ price: null });
    fixture.componentInstance.save();
    fixture.componentInstance.form.setValue({ price: 900 });
    fixture.componentInstance.save();
    backend
      .expectOne('/api/teacher/billing/default-price')
      .flush(null, { status: 500, statusText: 'Error' });
    await fixture.whenStable();

    expect(changed).toEqual([]);
    buttonByText(hostElement(fixture), 'Отмена').click();
    await fixture.whenStable();
    expect(button('Изменить цену для новых учеников')).toBeTruthy();
  });
});
