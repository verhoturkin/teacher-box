import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { ConfirmationService, MessageService } from 'primeng/api';
import { providePrimeNG } from 'primeng/config';
import { ledger, lesson, payment } from '@testing/billing-fixtures';
import { buttonByText, hostElement, readableText, requireElement } from '@testing/dom';
import { LessonDialog } from './lesson-dialog';
import { PaymentDialog } from './payment-dialog';
import { StudentLedgerPage } from './student-ledger-page';

describe('StudentLedgerPage', () => {
  let fixture: ComponentFixture<StudentLedgerPage>;
  let backend: HttpTestingController;
  let host: HTMLElement;
  let confirmation: ConfirmationService;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [StudentLedgerPage],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        providePrimeNG(),
        MessageService,
      ],
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

  it('changes the lesson price', async () => {
    expect(requireElement(host, '#lesson-price-input', HTMLInputElement).value.replace(/\s/g, ' ')).toContain('1 500');
    expect(buttonByText(host, 'Сохранить цену').disabled).toBe(true);

    fixture.componentInstance.price.setValue(2000);
    await fixture.whenStable();
    buttonByText(host, 'Сохранить цену').click();

    const request = backend.expectOne('/api/teacher/billing/students/s-1/price');
    expect(request.request.body).toEqual({ lessonPrice: 200_000 });
    request.flush({ studentId: 's-1', lessonPrice: 200_000 });
    await fixture.whenStable();

    expect(buttonByText(host, 'Сохранить цену').disabled).toBe(true);
    expect(TestBed.inject(MessageService).add).toHaveBeenCalled();
  });

  it('cancels a lesson after confirmation and reloads', async () => {
    buttonByText(host, 'Отменить занятие').click();

    const request = backend.expectOne('/api/teacher/billing/lessons/l-1/cancel');
    expect(request.request.body).toEqual({ reason: null });
    request.flush(lesson({ status: 'CANCELLED' }));
    backend.expectOne('/api/teacher/billing/students/s-1').flush(ledger({ lessons: [lesson({ status: 'CANCELLED' })] }));
    await fixture.whenStable();

    expect(host.querySelectorAll('tbody tr.tb-inactive')).toHaveLength(1);
  });

  it('voids a payment after confirmation and reloads', async () => {
    buttonByText(host, 'Аннулировать оплату').click();

    backend.expectOne('/api/teacher/billing/payments/p-1/void').flush(payment({ voidedAt: '2026-09-04T00:00:00Z' }));
    backend
      .expectOne('/api/teacher/billing/students/s-1')
      .flush(ledger({ balance: -150_000, payments: [payment({ voidedAt: '2026-09-04T00:00:00Z' })] }));
    await fixture.whenStable();

    expect(text()).toContain('долг 1 500 ₽');
  });

  it('records lessons and payments for this student', async () => {
    buttonByText(host, 'Занятие').click();
    await fixture.whenStable();
    const lessonDialog = fixture.debugElement.query(By.directive(LessonDialog)).injector.get(LessonDialog);
    expect(lessonDialog.form.controls.studentId.value).toBe('s-1');
    expect(lessonDialog.form.controls.price.value).toBe(1500);
    lessonDialog.save();
    backend.expectOne('/api/teacher/billing/lessons').flush(lesson());
    backend.expectOne('/api/teacher/billing/students/s-1').flush(ledger());

    buttonByText(host, 'Оплата').click();
    await fixture.whenStable();
    const paymentDialog = fixture.debugElement.query(By.directive(PaymentDialog)).injector.get(PaymentDialog);
    expect(paymentDialog.visible()).toBe(true);
    expect(paymentDialog.form.controls.studentId.value).toBe('s-1');
  });
});
