import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { payment, studentBalance } from '@testing/billing-fixtures';
import { bodyText, buttonByText, requireElement } from '@testing/dom';
import { Payment } from '../data-access/billing.models';
import { PaymentDialog } from './payment-dialog';
import { testProviders } from '@testing/setup';

describe('PaymentDialog', () => {
  let fixture: ComponentFixture<PaymentDialog>;
  let backend: HttpTestingController;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [PaymentDialog],
      providers: testProviders(),
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
    expect(bodyText()).not.toContain('Способ');

    dialog.form.patchValue({
      amount: 5000,
      paidOn: new Date(2026, 8, 3),
      comment: ' наличными ',
    });
    await fixture.whenStable();
    buttonByText(document.body, 'Сохранить').click();

    const request = backend.expectOne('/api/teacher/billing/payments');
    expect(request.request.body).toEqual({
      studentId: 's-1',
      amount: 500_000,
      paidOn: '2026-09-03',
      comment: 'наличными',
    });
    request.flush(payment());
    await fixture.whenStable();

    expect(saved).toHaveLength(1);
    expect(dialog.visible()).toBe(false);
  });

  it('keeps the student chosen in the list when opened without one', async () => {
    fixture.componentRef.setInput('visible', false);
    fixture.componentRef.setInput('students', [
      studentBalance(),
      studentBalance({ studentId: 's-2', displayName: 'Анна Смирнова' }),
    ]);
    fixture.componentRef.setInput('studentId', null);
    fixture.componentRef.setInput('visible', true);
    await fixture.whenStable();

    requireElement(document.body, 'p-select', HTMLElement).click();
    await fixture.whenStable();
    const option = Array.from(document.body.querySelectorAll('li[role="option"]')).find((item) =>
      item.textContent.includes('Анна Смирнова'),
    );
    if (!(option instanceof HTMLElement)) {
      throw new Error('Option "Анна Смирнова" not found');
    }
    option.click();
    await fixture.whenStable();

    expect(fixture.componentInstance.form.controls.studentId.value).toBe('s-2');
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
