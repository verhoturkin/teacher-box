import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MessageService } from 'primeng/api';
import { ledger } from '@testing/billing-fixtures';
import { buttonByText, hostElement, readableText, requireElement } from '@testing/dom';
import { StudentPriceCard } from './student-price-card';
import { testProviders } from '@testing/setup';

describe('StudentPriceCard', () => {
  let fixture: ComponentFixture<StudentPriceCard>;
  let backend: HttpTestingController;
  let host: HTMLElement;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [StudentPriceCard],
      providers: testProviders(),
    });
    backend = TestBed.inject(HttpTestingController);
    vi.spyOn(TestBed.inject(MessageService), 'add');
    fixture = TestBed.createComponent(StudentPriceCard);
    fixture.componentRef.setInput('studentId', 's-1');
    host = hostElement(fixture);
    await fixture.whenStable();
  });

  afterEach(() => {
    backend.verify();
    fixture.destroy();
  });

  async function loaded(): Promise<void> {
    backend.expectOne('/api/teacher/billing/students/s-1').flush(ledger());
    await fixture.whenStable();
  }

  function field(): HTMLInputElement {
    return requireElement(host, '#lesson-price-input', HTMLInputElement);
  }

  it('shows the saved price in its field under its label, «Сохранить» off until it changes', async () => {
    await loaded();

    expect(readableText(host)).toContain('Цена занятия');
    expect(field().value.replace(/\s/g, ' ')).toContain('1 500');
    expect(requireElement(host, '.tb-field > label', HTMLLabelElement).htmlFor).toBe(
      'lesson-price-input',
    );
    expect(buttonByText(host, 'Сохранить').disabled).toBe(true);
    expect(host.querySelector('.tb-form-actions')?.textContent).not.toContain('Отмена');
  });

  it('saves a new price in place', async () => {
    await loaded();
    fixture.componentInstance.price.setValue(2000);
    await fixture.whenStable();
    buttonByText(host, 'Сохранить').click();

    const request = backend.expectOne('/api/teacher/billing/students/s-1/price');
    expect(request.request.body).toEqual({ lessonPrice: 200_000 });
    request.flush({ studentId: 's-1', lessonPrice: 200_000 });
    await fixture.whenStable();

    expect(buttonByText(host, 'Сохранить').disabled).toBe(true);
    expect(TestBed.inject(MessageService).add).toHaveBeenCalledWith(
      expect.objectContaining({ detail: 'Цена занятия изменена' }),
    );
  });

  it('keeps the typed price when saving fails', async () => {
    await loaded();
    fixture.componentInstance.price.setValue(2000);
    await fixture.whenStable();
    buttonByText(host, 'Сохранить').click();

    backend
      .expectOne('/api/teacher/billing/students/s-1/price')
      .flush({ status: 500 }, { status: 500, statusText: 'Error' });
    await fixture.whenStable();

    expect(fixture.componentInstance.price.value).toBe(2000);
    expect(buttonByText(host, 'Сохранить').disabled).toBe(false);
  });

  it('brings back the saved price on «Отмена»', async () => {
    await loaded();
    fixture.componentInstance.price.setValue(2000);
    await fixture.whenStable();
    buttonByText(host, 'Отмена').click();
    await fixture.whenStable();

    expect(fixture.componentInstance.price.value).toBe(1500);
    expect(buttonByText(host, 'Сохранить').disabled).toBe(true);
  });

  it('does not save a price that did not change', async () => {
    await loaded();
    requireElement(host, 'form', HTMLFormElement).requestSubmit();

    backend.expectNone('/api/teacher/billing/students/s-1/price');
  });

  it('offers to read the price again when it cannot be read', async () => {
    backend
      .expectOne('/api/teacher/billing/students/s-1')
      .flush({ status: 500 }, { status: 500, statusText: 'Error' });
    await fixture.whenStable();
    expect(host.querySelector('#lesson-price-input')).toBeNull();

    buttonByText(host, 'Повторить').click();
    await loaded();

    expect(field()).toBeTruthy();
  });
});
