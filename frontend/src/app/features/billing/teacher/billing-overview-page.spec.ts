import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { MessageService } from 'primeng/api';
import { overview, payment, studentBalance } from '@testing/billing-fixtures';
import { buttonByText, hostElement, readableText, requireElement } from '@testing/dom';
import { BillingOverviewPage } from './billing-overview-page';
import { PaymentDialog } from './payment-dialog';
import { testProviders } from '@testing/setup';

const IVAN = studentBalance({
  studentId: 's-1',
  displayName: 'Иван',
  balance: -150_000,
  chargedLessons: 3,
  lastLessonDate: '2026-09-01',
});
const MARIA = studentBalance({ studentId: 's-2', displayName: 'Мария', balance: 300_000 });
const OLEG = studentBalance({ studentId: 's-3', displayName: 'Олег', status: 'DEACTIVATED' });

describe('BillingOverviewPage', () => {
  let fixture: ComponentFixture<BillingOverviewPage>;
  let backend: HttpTestingController;
  let host: HTMLElement;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [BillingOverviewPage],
      providers: testProviders(),
    });
    backend = TestBed.inject(HttpTestingController);
    vi.spyOn(TestBed.inject(MessageService), 'add');
    fixture = TestBed.createComponent(BillingOverviewPage);
    host = hostElement(fixture);
    await fixture.whenStable();
    backend.expectOne('/api/teacher/billing/overview').flush(overview([IVAN, MARIA, OLEG]));
    await fixture.whenStable();
  });

  afterEach(() => {
    backend.verify();
    fixture.destroy();
  });

  function normalizedText(): string {
    return readableText(host);
  }

  function rows(): string[] {
    return Array.from(host.querySelectorAll('tbody tr')).map((row) => readableText(row));
  }

  it('shows totals and balances', () => {
    expect(normalizedText()).toContain('Долг учеников 1 500 ₽');
    expect(normalizedText()).toContain('Авансы 3 000 ₽');
    expect(normalizedText()).toContain('Должников 1');
    expect(rows()).toHaveLength(3);
    expect(rows()[0]).toContain('Иван');
    expect(rows()[0]).toContain('01.09.2026');
    expect(rows()[0]).toContain('долг 1 500 ₽');
    expect(rows()[1]).toContain('аванс 3 000 ₽');
    expect(rows()[2]).toContain('О Олег отключён');
  });

  it('filters debtors', async () => {
    requireElement(host, '#only-debtors', HTMLInputElement).click();
    await fixture.whenStable();

    expect(rows()).toHaveLength(1);
    expect(rows()[0]).toContain('Иван');
  });

  it('does not record lessons: they are charged when marked in the schedule', () => {
    const buttons = Array.from(host.querySelectorAll('button')).map(
      (button) => `${button.textContent} ${button.getAttribute('aria-label') ?? ''}`,
    );

    expect(buttons.filter((label) => label.includes('Занятие'))).toEqual([]);
  });

  it('shows a failed load with «Повторить»', async () => {
    const failing = TestBed.createComponent(BillingOverviewPage);
    await failing.whenStable();
    backend
      .expectOne('/api/teacher/billing/overview')
      .flush(null, { status: 500, statusText: 'Error' });
    await failing.whenStable();
    const page = hostElement(failing);

    expect(readableText(page)).toContain('Не удалось загрузить оплаты');

    buttonByText(page, 'Повторить').click();
    backend.expectOne('/api/teacher/billing/overview').flush(overview([IVAN]));
    await failing.whenStable();

    expect(readableText(page)).toContain('Долг учеников');
    failing.destroy();
  });

  it('opens the payment dialog from the home page', async () => {
    const fromHome = TestBed.createComponent(BillingOverviewPage);
    fromHome.componentRef.setInput('create', 'payment');
    await fromHome.whenStable();
    backend.expectOne('/api/teacher/billing/overview').flush(overview([IVAN]));
    await fromHome.whenStable();

    expect(
      fromHome.debugElement
        .query(By.directive(PaymentDialog))
        .injector.get(PaymentDialog)
        .visible(),
    ).toBe(true);
    fromHome.destroy();
  });

  it('opens the payment dialog from the toolbar and for a student', async () => {
    buttonByText(host, 'Оплата').click();
    await fixture.whenStable();
    const dialog = fixture.debugElement
      .query(By.directive(PaymentDialog))
      .injector.get(PaymentDialog);
    expect(dialog.visible()).toBe(true);
    expect(dialog.form.controls.studentId.value).toBeNull();

    dialog.visible.set(false);
    await fixture.whenStable();
    buttonByText(host, 'Принять оплату: Мария').click();
    await fixture.whenStable();
    expect(dialog.form.controls.studentId.value).toBe('s-2');

    dialog.form.patchValue({ amount: 100 });
    dialog.save();
    backend.expectOne('/api/teacher/billing/payments').flush(payment());
    await fixture.whenStable();
    expect(TestBed.inject(MessageService).add).toHaveBeenCalledWith(
      expect.objectContaining({ detail: 'Оплата сохранена' }),
    );
    backend.expectOne('/api/teacher/billing/overview').flush(overview([]));
    await fixture.whenStable();

    expect(normalizedText()).toContain('Добавьте учеников');
  });
});
