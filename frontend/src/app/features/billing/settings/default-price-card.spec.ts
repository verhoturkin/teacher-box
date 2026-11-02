import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { hostElement, readableText, requireElement } from '@testing/dom';
import { DefaultPriceCard } from './default-price-card';
import { overview } from '@testing/billing-fixtures';
import { testProviders } from '@testing/setup';

describe('DefaultPriceCard', () => {
  let fixture: ComponentFixture<DefaultPriceCard>;
  let backend: HttpTestingController;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [DefaultPriceCard],
      providers: testProviders(),
    });
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(DefaultPriceCard);
    await fixture.whenStable();
    backend.expectOne('/api/teacher/billing/overview').flush(overview([]));
    await fixture.whenStable();
  });

  afterEach(() => {
    backend.verify();
    fixture.destroy();
  });

  it('shows the price in a field under its label and saves it on change', async () => {
    const host = hostElement(fixture);
    expect(requireElement(host, '.tb-field > label', HTMLLabelElement).htmlFor).toBe(
      'default-price-input',
    );
    expect(requireElement(host, 'input', HTMLInputElement).value).toContain('1');
    expect(readableText(host)).toContain(
      'Цену каждого ученика меняют на вкладке «Профиль» его карточки',
    );

    fixture.componentInstance.form.setValue({ price: 1800 });
    fixture.componentInstance.save();

    const request = backend.expectOne({ method: 'PUT', url: '/api/teacher/billing/default-price' });
    expect(request.request.body).toEqual({ lessonPrice: 180_000 });
    request.flush({ lessonPrice: 180_000 });
    await fixture.whenStable();

    // the same price again changes nothing
    fixture.componentInstance.save();
  });

  it('does not save an empty field or an unchanged price, and can save again after a failure', async () => {
    fixture.componentInstance.save();
    fixture.componentInstance.form.setValue({ price: null });
    fixture.componentInstance.save();
    fixture.componentInstance.form.setValue({ price: 900 });
    fixture.componentInstance.save();
    fixture.componentInstance.save();
    backend
      .expectOne('/api/teacher/billing/default-price')
      .flush(null, { status: 500, statusText: 'Error' });
    await fixture.whenStable();

    fixture.componentInstance.save();
    backend.expectOne('/api/teacher/billing/default-price').flush({ lessonPrice: 90_000 });
  });
});
