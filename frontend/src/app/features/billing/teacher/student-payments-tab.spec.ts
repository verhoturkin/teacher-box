import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ledger, lesson, payment } from '@testing/billing-fixtures';
import { hostElement, readableText, requireElement } from '@testing/dom';
import { LedgerList } from '../ledger/ledger-list';
import { StudentPaymentsTab } from './student-payments-tab';
import { testProviders } from '@testing/setup';

describe('StudentPaymentsTab', () => {
  let fixture: ComponentFixture<StudentPaymentsTab>;
  let backend: HttpTestingController;
  let host: HTMLElement;
  let confirmation: ConfirmationService;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [StudentPaymentsTab],
      providers: testProviders(),
    });
    backend = TestBed.inject(HttpTestingController);
    vi.spyOn(TestBed.inject(MessageService), 'add');
    fixture = TestBed.createComponent(StudentPaymentsTab);
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
    expect(text()).toContain('аванс 3 500 ₽');
    expect(text()).toContain('Начислено за всё время 1 500 ₽');
    expect(text()).toContain('Оплачено за всё время 5 000 ₽');
    expect(host.querySelectorAll('.tb-list > li')).toHaveLength(2);
  });

  it('shows the lesson price without changing it: the price is changed on Профиль', () => {
    expect(text()).toContain('Цена занятия 1 500 ₽');
    expect(host.querySelector('#lesson-price-input')).toBeNull();
    expect(host.querySelector('button[aria-label="Изменить цену занятия"]')).toBeNull();
  });

  it('cancels a lesson after confirmation, reloads and tells the card', async () => {
    const changed = vi.fn();
    fixture.componentInstance.changed.subscribe(changed);
    requireElement(host, 'button[aria-label^="Снять начисление за "]', HTMLButtonElement).click();
    await fixture.whenStable();

    const request = backend.expectOne('/api/teacher/billing/lessons/l-1/cancel');
    expect(request.request.body).toEqual({ reason: null });
    request.flush(lesson({ status: 'CANCELLED' }));
    backend
      .expectOne('/api/teacher/billing/students/s-1')
      .flush(ledger({ lessons: [lesson({ status: 'CANCELLED' })] }));
    await fixture.whenStable();

    expect(host.querySelectorAll('.tb-list > li.tb-inactive')).toHaveLength(1);
    expect(changed).toHaveBeenCalledOnce();
  });

  it('voids a payment after confirmation and reloads', async () => {
    requireElement(
      host,
      'button[aria-label^="Аннулировать оплату от "]',
      HTMLButtonElement,
    ).click();
    await fixture.whenStable();

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

  it('attaches and removes receipts and reloads', async () => {
    const list = fixture.debugElement.query(By.directive(LedgerList)).injector.get(LedgerList);
    const big = new File(['x'], 'big.pdf');
    Object.defineProperty(big, 'size', { value: 10 * 1024 * 1024 + 1 });
    list.attachReceipt.emit({ payment: payment(), file: big });
    backend.expectNone('/api/teacher/billing/payments/p-1/receipt');

    list.attachReceipt.emit({ payment: payment(), file: new File(['%PDF'], 'a.pdf') });
    await fixture.whenStable();
    expect(list.receiptBusy()).toBe('p-1');
    backend
      .expectOne({ method: 'PUT', url: '/api/teacher/billing/payments/p-1/receipt' })
      .flush(payment());
    backend.expectOne('/api/teacher/billing/students/s-1').flush(ledger());
    await fixture.whenStable();
    expect(list.receiptBusy()).toBeNull();

    list.attachReceipt.emit({ payment: payment(), file: new File(['x'], 'a.txt') });
    backend
      .expectOne({ method: 'PUT', url: '/api/teacher/billing/payments/p-1/receipt' })
      .flush({ code: 'receipt.type-not-allowed' }, { status: 422, statusText: 'Unprocessable' });
    await fixture.whenStable();
    expect(list.receiptBusy()).toBeNull();

    list.removeReceipt.emit(payment());
    await fixture.whenStable();
    backend
      .expectOne({ method: 'DELETE', url: '/api/teacher/billing/payments/p-1/receipt' })
      .flush(payment());
    backend.expectOne('/api/teacher/billing/students/s-1').flush(ledger());
  });

  it('shows a failed load with «Повторить»', async () => {
    fixture.componentInstance.reload();
    backend
      .expectOne('/api/teacher/billing/students/s-1')
      .flush({ status: 404, code: 'student.not-found' }, { status: 404, statusText: 'Not Found' });
    await fixture.whenStable();

    expect(text()).toContain('Не удалось загрузить историю оплат Ученик не найден Повторить');
  });

  it('reads the history again when the card recorded a payment or opened another student', async () => {
    fixture.componentRef.setInput('revision', 1);
    await fixture.whenStable();
    backend.expectOne('/api/teacher/billing/students/s-1').flush(ledger());

    fixture.componentRef.setInput('studentId', 's-2');
    await fixture.whenStable();
    backend.expectOne('/api/teacher/billing/students/s-2').flush(ledger({ studentId: 's-2' }));
  });

  it('leaves recording a payment to the card', () => {
    const labels = Array.from(host.querySelectorAll('button')).map((button) =>
      button.textContent.trim(),
    );
    expect(labels).not.toContain('Оплата');
  });
});
