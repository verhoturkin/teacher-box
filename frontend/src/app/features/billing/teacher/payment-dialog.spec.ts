import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { providePrimeNG } from 'primeng/config';
import { payment, studentBalance } from '@testing/billing-fixtures';
import { bodyText, buttonByText } from '@testing/dom';
import { Payment } from '../data-access/billing.models';
import { PaymentDialog } from './payment-dialog';

describe('PaymentDialog', () => {
  let fixture: ComponentFixture<PaymentDialog>;
  let backend: HttpTestingController;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [PaymentDialog],
      providers: [provideHttpClient(), provideHttpClientTesting(), providePrimeNG()],
    });
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(PaymentDialog);
    fixture.componentRef.setInput('students', [studentBalance()]);
    fixture.componentRef.setInput('currency', 'RUB');
    fixture.componentRef.setInput('studentId', 's-1');
    fixture.componentRef.setInput('visible', true);
    await fixture.whenStable();
  });

  afterEach(() => {
    backend.verify();
    fixture.destroy();
  });

  it('registers a payment', async () => {
    const saved: Payment[] = [];
    fixture.componentInstance.saved.subscribe((value) => saved.push(value));
    const dialog = fixture.componentInstance;
    expect(bodyText()).toContain('Оплата');
    expect(dialog.form.controls.method.value).toBe('TRANSFER');

    dialog.form.patchValue({ amount: 5000, paidOn: new Date(2026, 8, 3), method: 'CASH', comment: ' наличными ' });
    await fixture.whenStable();
    buttonByText(document.body, 'Сохранить').click();

    const request = backend.expectOne('/api/teacher/billing/payments');
    expect(request.request.body).toEqual({
      studentId: 's-1',
      amount: 500_000,
      paidOn: '2026-09-03',
      method: 'CASH',
      comment: 'наличными',
    });
    request.flush(payment());
    await fixture.whenStable();

    expect(saved).toHaveLength(1);
    expect(dialog.visible()).toBe(false);
  });

  it('requires an amount', () => {
    fixture.componentInstance.save();

    backend.expectNone('/api/teacher/billing/payments');
  });

  it('shows errors', async () => {
    fixture.componentInstance.form.patchValue({ amount: 10 });
    fixture.componentInstance.save();

    const request = backend.expectOne('/api/teacher/billing/payments');
    expect(request.request.body).toEqual(expect.objectContaining({ comment: null }));
    request.flush(null, { status: 500, statusText: 'Error' });
    await fixture.whenStable();

    expect(bodyText()).toContain('Не удалось сохранить оплату');
  });

  it('closes on cancel', () => {
    buttonByText(document.body, 'Отмена').click();

    expect(fixture.componentInstance.visible()).toBe(false);
  });
});
