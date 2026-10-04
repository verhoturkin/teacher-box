import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ledger, lesson, payment } from '@testing/billing-fixtures';
import { buttonByText, hostElement, readableText, requireElement } from '@testing/dom';
import { PaymentDialog } from './payment-dialog';
import { StudentLedgerPage } from './student-ledger-page';
import { testProviders } from '@testing/setup';

describe('StudentLedgerPage', () => {
  let fixture: ComponentFixture<StudentLedgerPage>;
  let backend: HttpTestingController;
  let host: HTMLElement;
  let confirmation: ConfirmationService;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [StudentLedgerPage],
      providers: testProviders(),
    });
    backend = TestBed.inject(HttpTestingController);
    vi.spyOn(TestBed.inject(MessageService), 'add');
    fixture = TestBed.createComponent(StudentLedgerPage);
    fixture.componentRef.setInput('studentId', 's-1');
    host = hostElement(fixture);
    await fixture.whenStable();
    backend.expectOne('/api/teacher/billing/students/s-1').flush(ledger());
    await fixture.whenStable();
    confirmation = fixture.debugElement.injector.get(ConfirmationService);
    vi.spyOn(confirmation, 'confirm').mockImplementation((options) => {
      options.accept?.();
      return confirmation;
    });
  });

  afterEach(() => {
    backend.verify();
    fixture.destroy();
  });

  function text(): string {
    return readableText(host);
  }

  it('shows the student history and totals', () => {
    expect(text()).toContain('Иван Петров');
    expect(text()).toContain('аванс 3 500 ₽');
    expect(text()).toContain('Начислено за всё время 1 500 ₽');
    expect(text()).toContain('Оплачено за всё время 5 000 ₽');
    expect(host.querySelectorAll('tbody tr')).toHaveLength(2);
  });

  it('changes the lesson price in place: the field under its label, the buttons under it', async () => {
    expect(host.querySelector('#lesson-price-input')).toBeNull();
    buttonByText(host, 'Изменить цену занятия').click();
    await fixture.whenStable();
    expect(
      requireElement(host, '#lesson-price-input', HTMLInputElement).value.replace(/\s/g, ' '),
    ).toContain('1 500');
    expect(requireElement(host, '.tb-field > label', HTMLLabelElement).htmlFor).toBe(
      'lesson-price-input',
    );
    expect(host.querySelector('.tb-form-actions')).not.toBeNull();
    expect(buttonByText(host, 'Сохранить').disabled).toBe(true);

    fixture.componentInstance.price.setValue(2000);
    await fixture.whenStable();
    buttonByText(host, 'Сохранить').click();

    const request = backend.expectOne('/api/teacher/billing/students/s-1/price');
    expect(request.request.body).toEqual({ lessonPrice: 200_000 });
    request.flush({ studentId: 's-1', lessonPrice: 200_000 });
    await fixture.whenStable();

    expect(host.querySelector('#lesson-price-input')).toBeNull();
    expect(text()).toContain('Цена занятия 2 000 ₽');
    expect(TestBed.inject(MessageService).add).toHaveBeenCalled();
  });

  it('leaves the lesson price as it was when editing is cancelled', async () => {
    buttonByText(host, 'Изменить цену занятия').click();
    await fixture.whenStable();
    fixture.componentInstance.price.setValue(2000);
    buttonByText(host, 'Отмена').click();
    await fixture.whenStable();

    expect(host.querySelector('#lesson-price-input')).toBeNull();
    expect(text()).toContain('Цена занятия 1 500 ₽');
    expect(fixture.componentInstance.price.value).toBe(1500);
  });

  it('cancels a lesson after confirmation and reloads', async () => {
    requireElement(host, 'button[aria-label^="Снять начисление за "]', HTMLButtonElement).click();

    const request = backend.expectOne('/api/teacher/billing/lessons/l-1/cancel');
    expect(request.request.body).toEqual({ reason: null });
    request.flush(lesson({ status: 'CANCELLED' }));
    backend
      .expectOne('/api/teacher/billing/students/s-1')
      .flush(ledger({ lessons: [lesson({ status: 'CANCELLED' })] }));
    await fixture.whenStable();

    expect(host.querySelectorAll('tbody tr.tb-inactive')).toHaveLength(1);
  });

  it('voids a payment after confirmation and reloads', async () => {
    requireElement(
      host,
      'button[aria-label^="Аннулировать оплату от "]',
      HTMLButtonElement,
    ).click();

    backend
      .expectOne('/api/teacher/billing/payments/p-1/void')
      .flush(payment({ voidedAt: '2026-09-04T00:00:00Z' }));
    backend
      .expectOne('/api/teacher/billing/students/s-1')
      .flush(
        ledger({ balance: -150_000, payments: [payment({ voidedAt: '2026-09-04T00:00:00Z' })] }),
      );
    await fixture.whenStable();

    expect(text()).toContain('долг 1 500 ₽');
  });

  it('shows a failed load with «Повторить» and the way back', async () => {
    fixture.componentInstance.reload();
    backend
      .expectOne('/api/teacher/billing/students/s-1')
      .flush({ status: 404, code: 'student.not-found' }, { status: 404, statusText: 'Not Found' });
    await fixture.whenStable();

    expect(text()).toContain('Не удалось загрузить историю оплат Ученик не найден Повторить');
  });

  it('records payments, not lessons, for this student', async () => {
    expect(
      Array.from(host.querySelectorAll('button')).map((button) => button.textContent.trim()),
    ).not.toContain('Занятие');

    buttonByText(host, 'Оплата').click();
    await fixture.whenStable();
    const paymentDialog = fixture.debugElement
      .query(By.directive(PaymentDialog))
      .injector.get(PaymentDialog);
    expect(paymentDialog.visible()).toBe(true);
    expect(paymentDialog.form.controls.studentId.value).toBe('s-1');
    paymentDialog.form.patchValue({ amount: 100 });
    paymentDialog.save();
    backend.expectOne('/api/teacher/billing/payments').flush(payment());
    backend.expectOne('/api/teacher/billing/students/s-1').flush(ledger());
  });
});
