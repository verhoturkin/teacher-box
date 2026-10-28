import { HttpRequest } from '@angular/common/http';
import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import {
  billingSummary,
  operation,
  operations,
  overview,
  payment,
  studentBalance,
} from '@testing/billing-fixtures';
import { buttonByText, hostElement, readableText, requireElement } from '@testing/dom';
import { screenWidth, testProviders } from '@testing/setup';
import { BroadcastDialog } from '@features/notifications/parts';
import { RailState } from '@core/layout/rail-state';
import { toIsoMonth } from '@shared/dates/iso-date';
import { BillingOverviewPage } from './billing-overview-page';
import { PaymentDialog } from './payment-dialog';

const MONTH = toIsoMonth(new Date());
const IVAN = studentBalance({
  studentId: 's-1',
  displayName: 'Иван',
  balance: -300_000,
  lessonPrice: 150_000,
  lastLessonDate: '2026-09-12',
});
const MARIA = studentBalance({
  studentId: 's-2',
  displayName: 'Мария',
  balance: 150_000,
  lessonPrice: 150_000,
});
const OLEG = studentBalance({
  studentId: 's-3',
  displayName: 'Олег',
  balance: 900_000,
  lessonPrice: 150_000,
});
const LESSON = operation({ id: 'o-1', studentName: 'Иван', note: 'Дроби' });
const PAID = operation({
  id: 'o-2',
  kind: 'PAYMENT',
  studentId: 's-2',
  studentName: 'Мария',
  amount: 600_000,
  status: null,
  note: 'наличные',
  date: '2026-09-18',
});
const SKIPPED = operation({
  id: 'o-3',
  kind: 'ABSENCE',
  status: 'CANCELLED',
  amount: 0,
  date: '2026-09-16',
});

function matching(path: string, params: Record<string, string> = {}) {
  return (request: HttpRequest<unknown>): boolean =>
    request.url === path &&
    Object.entries(params).every(([key, value]) => request.params.get(key) === value);
}

describe('BillingOverviewPage', () => {
  let fixture: ComponentFixture<BillingOverviewPage>;
  let backend: HttpTestingController;
  let host: HTMLElement;

  async function flushPage(page: ComponentFixture<BillingOverviewPage>): Promise<void> {
    await page.whenStable();
    backend.expectOne('/api/teacher/billing/overview').flush(overview([IVAN, MARIA, OLEG]));
    backend.expectOne(matching('/api/teacher/billing/summary', { month: MONTH })).flush(
      billingSummary({
        income: 4_200_000,
        totalDebt: 300_000,
        debtors: 1,
        month: MONTH,
        weeks: [
          { from: `${MONTH}-01`, to: `${MONTH}-04`, income: 1_200_000, charged: 1_000_000 },
          { from: `${MONTH}-05`, to: `${MONTH}-11`, income: 0, charged: 500_000 },
        ],
      }),
    );
    backend
      .expectOne(matching('/api/teacher/billing/operations', { month: MONTH }))
      .flush(operations([LESSON, PAID, SKIPPED], MONTH));
    await page.whenStable();
  }

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [BillingOverviewPage],
      providers: testProviders(),
    });
    backend = TestBed.inject(HttpTestingController);
    vi.spyOn(TestBed.inject(MessageService), 'add');
    fixture = TestBed.createComponent(BillingOverviewPage);
    host = hostElement(fixture);
    await flushPage(fixture);
  });

  afterEach(() => {
    backend.verify();
    fixture.destroy();
  });

  function text(): string {
    return readableText(host);
  }

  function journal(): string[] {
    return Array.from(host.querySelectorAll('.tb-ops__list > li')).map((row) => readableText(row));
  }

  it('shows the four figures of the month', () => {
    expect(text()).toContain('Поступило 42 000 ₽ 1 оплата');
    expect(text()).toContain('Начислено за занятия 15 000 ₽ 1 занятие');
    expect(text()).toContain('Долг 3 000 ₽ 1 ученик');
    expect(text()).toContain('Авансы 10 500 ₽ 2 ученика');
  });

  it('lists the operations of the month', () => {
    expect(journal()).toHaveLength(3);
    expect(journal()[0]).toContain('Занятие · Иван');
    expect(journal()[0]).toContain('19.09 · Дроби');
    expect(journal()[0]).toContain('−1 500 ₽');
    expect(journal()[1]).toContain('Оплата · Мария');
    expect(journal()[1]).toContain('+6 000 ₽');
    expect(journal()[2]).toContain('Отмена · Иван Петров');
    expect(journal()[2]).toContain('без списания');
  });

  it('asks the server for one kind of operations when a chip is chosen', async () => {
    buttonByText(host, 'Оплаты').click();
    backend
      .expectOne(matching('/api/teacher/billing/operations', { month: MONTH, kind: 'PAYMENT' }))
      .flush(operations([PAID], MONTH));
    await fixture.whenStable();

    expect(journal()).toHaveLength(1);
    expect(text()).toContain('Поступило 42 000 ₽ 1 оплата');

    buttonByText(host, 'Все').click();
    await fixture.whenStable();
    expect(journal()).toHaveLength(3);
  });

  it('narrows the journal to a student', async () => {
    fixture.componentInstance.studentControl.setValue('s-2');
    backend
      .expectOne(matching('/api/teacher/billing/operations', { month: MONTH, studentId: 's-2' }))
      .flush(operations([PAID], MONTH));
    await fixture.whenStable();

    expect(journal()).toHaveLength(1);
  });

  it('keeps the list when a narrowed request fails', async () => {
    buttonByText(host, 'Занятия').click();
    backend
      .expectOne(matching('/api/teacher/billing/operations', { kind: 'LESSON' }))
      .flush(null, { status: 500, statusText: 'Error' });
    await fixture.whenStable();

    expect(text()).toContain('Занятие · Иван');
  });

  it('shows debtors, the prepaid running out and the weekly bars', () => {
    const pane = text();

    expect(pane).toContain('Иван 2 занятия · последнее 12.09 -3 000 ₽');
    expect(pane).toContain('Мария хватит на 1 занятие 1 500 ₽');
    expect(pane).not.toContain('хватит на 6');
    expect(host.querySelectorAll('.tb-ops__week')).toHaveLength(2);
    expect(text()).toContain('12 000');
    expect(requireElement(host, '.tb-ops__all', HTMLAnchorElement).getAttribute('href')).toBe(
      '/teacher/students',
    );
  });

  it('reminds the debtors with a message', async () => {
    buttonByText(host, 'Напомнить').click();
    await fixture.whenStable();

    const dialog = fixture.debugElement
      .query(By.directive(BroadcastDialog))
      .injector.get(BroadcastDialog);
    expect(dialog.visible()).toBe(true);
    expect(dialog.toGroup()?.members.map((member) => member.id)).toEqual(['s-1']);
  });

  it('moves to the previous month and not past the current one', async () => {
    const next = requireElement(host, 'button[aria-label="Следующий месяц"]', HTMLButtonElement);
    expect(next.disabled).toBe(true);

    const [year, month] = MONTH.split('-').map(Number);
    const previous = toIsoMonth(new Date(year ?? 0, (month ?? 1) - 2, 1));
    requireElement(host, 'button[aria-label="Предыдущий месяц"]', HTMLButtonElement).click();
    backend
      .expectOne(matching('/api/teacher/billing/summary', { month: previous }))
      .flush(billingSummary({ month: previous }));
    backend
      .expectOne(matching('/api/teacher/billing/operations', { month: previous }))
      .flush(operations([], previous));
    await fixture.whenStable();

    expect(text()).toContain('В этом месяце операций нет');
    expect(next.disabled).toBe(false);
  });

  it('links «Отчёт за месяц» to the report of the month', () => {
    const link = requireElement(host, 'a[href*="report"]', HTMLAnchorElement);

    expect(link.textContent).toContain('Отчёт за месяц');
    expect(link.getAttribute('href')).toContain(`month=${MONTH}`);
  });

  it('has no «⋮» menu in the header: the CSV lives in the monthly report', () => {
    expect(host.querySelector('button[aria-label="Ещё"]')).toBeNull();
  });

  it('shows a failed load with «Повторить»', async () => {
    const failing = TestBed.createComponent(BillingOverviewPage);
    await failing.whenStable();
    backend
      .expectOne('/api/teacher/billing/overview')
      .flush(null, { status: 500, statusText: 'x' });
    backend.match(matching('/api/teacher/billing/summary'));
    backend.match(matching('/api/teacher/billing/operations'));
    await failing.whenStable();
    const page = hostElement(failing);

    expect(readableText(page)).toContain('Не удалось загрузить оплаты');

    buttonByText(page, 'Повторить').click();
    await flushPage(failing);

    expect(readableText(page)).toContain('Операции');
    failing.destroy();
  });

  it('opens the payment dialog from «Создать» and drops ?create', async () => {
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/?create=payment');
    await fixture.whenStable();

    expect(
      fixture.debugElement.query(By.directive(PaymentDialog)).injector.get(PaymentDialog).visible(),
    ).toBe(true);
    expect(router.url).toBe('/');
  });

  it('reloads the page after a payment is saved', async () => {
    await TestBed.inject(Router).navigateByUrl('/?create=payment');
    await fixture.whenStable();
    const dialog = fixture.debugElement
      .query(By.directive(PaymentDialog))
      .injector.get(PaymentDialog);

    dialog.form.patchValue({ studentId: 's-2', amount: 100 });
    buttonByText(document.body, 'Сохранить').click();
    backend.expectOne('/api/teacher/billing/payments').flush(payment());
    await fixture.whenStable();

    expect(TestBed.inject(MessageService).add).toHaveBeenCalledWith(
      expect.objectContaining({ detail: 'Оплата сохранена' }),
    );
    backend.expectOne('/api/teacher/billing/overview').flush(overview([]));
    backend.expectOne(matching('/api/teacher/billing/summary')).flush(billingSummary());
    backend.expectOne(matching('/api/teacher/billing/operations')).flush(operations([]));
    await fixture.whenStable();

    expect(text()).toContain('Должников нет');
  });
});

describe('BillingOverviewPage on a phone', () => {
  let fixture: ComponentFixture<BillingOverviewPage>;
  let backend: HttpTestingController;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [BillingOverviewPage],
      providers: testProviders(screenWidth(599)),
    });
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(BillingOverviewPage);
    await fixture.whenStable();
    backend.expectOne('/api/teacher/billing/overview').flush(overview([IVAN, MARIA]));
    backend
      .expectOne(matching('/api/teacher/billing/summary', { month: MONTH }))
      .flush(billingSummary({ month: MONTH }));
    backend
      .expectOne(matching('/api/teacher/billing/operations', { month: MONTH }))
      .flush(operations([LESSON, PAID], MONTH));
    await fixture.whenStable();
  });

  afterEach(() => {
    backend.verify();
    fixture.destroy();
  });

  it('shows both month arrows and a report link directly in the page', () => {
    const host = hostElement(fixture);
    expect(TestBed.inject(RailState).compactBar()).toBeNull();
    expect(buttonByText(host, 'Предыдущий месяц')).not.toBeNull();
    expect(buttonByText(host, 'Следующий месяц').disabled).toBe(true);
    const report = requireElement(host, 'a[href*="/teacher/billing/report"]', HTMLAnchorElement);
    expect(report.getAttribute('href')).toContain('month=' + MONTH);
    expect(host.querySelector('p-button.tb-page-fab')).not.toBeNull();
  });

  it('shows the debtors under the figures, with «Напомнить»', () => {
    const host = hostElement(fixture);
    expect(host.querySelectorAll('.tb-ops__people')).toHaveLength(1);
    expect(host.textContent).toContain('Должники');
    expect(host.textContent).toContain('Иван');
    expect(buttonByText(host, 'Напомнить')).not.toBeNull();
  });

  it('navigates months and updates the report month', async () => {
    const host = hostElement(fixture);
    buttonByText(host, 'Предыдущий месяц').click();
    const [year, month] = MONTH.split('-').map(Number);
    const previous = toIsoMonth(new Date(year ?? 0, (month ?? 1) - 2, 1));
    backend
      .expectOne(matching('/api/teacher/billing/summary', { month: previous }))
      .flush(billingSummary({ month: previous }));
    backend
      .expectOne(matching('/api/teacher/billing/operations', { month: previous }))
      .flush(operations([], previous));
    await fixture.whenStable();
    expect(buttonByText(host, 'Следующий месяц').disabled).toBe(false);
    expect(
      requireElement(host, 'a[href*="/teacher/billing/report"]', HTMLAnchorElement).getAttribute(
        'href',
      ),
    ).toContain('month=' + previous);
  });
});

describe('BillingOverviewPage filters in the address', () => {
  let backend: HttpTestingController;
  let router: Router;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [BillingOverviewPage], providers: testProviders() });
    backend = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
  });

  afterEach(() => {
    backend.verify();
  });

  it('writes the kind, the student and the month to the address', async () => {
    const fixture = TestBed.createComponent(BillingOverviewPage);
    await fixture.whenStable();
    backend.expectOne('/api/teacher/billing/overview').flush(overview([IVAN, MARIA]));
    backend.expectOne(matching('/api/teacher/billing/summary')).flush(billingSummary());
    backend.expectOne(matching('/api/teacher/billing/operations')).flush(operations([], MONTH));
    await fixture.whenStable();

    buttonByText(hostElement(fixture), 'Оплаты').click();
    backend
      .expectOne(matching('/api/teacher/billing/operations', { kind: 'PAYMENT' }))
      .flush(operations([], MONTH));
    await fixture.whenStable();
    expect(router.url).toBe('/?kind=payments');

    fixture.componentInstance.studentControl.setValue('s-2');
    backend
      .expectOne(matching('/api/teacher/billing/operations', { studentId: 's-2' }))
      .flush(operations([], MONTH));
    await fixture.whenStable();
    expect(router.url).toBe('/?kind=payments&student=s-2');

    buttonByText(hostElement(fixture), 'Предыдущий месяц').click();
    const [year, month] = MONTH.split('-').map(Number);
    const previous = toIsoMonth(new Date(year ?? 0, (month ?? 1) - 2, 1));
    backend.expectOne(matching('/api/teacher/billing/summary')).flush(billingSummary());
    backend
      .expectOne(matching('/api/teacher/billing/operations', { month: previous }))
      .flush(operations([], previous));
    await fixture.whenStable();
    backend
      .expectOne(
        matching('/api/teacher/billing/operations', {
          month: previous,
          kind: 'PAYMENT',
          studentId: 's-2',
        }),
      )
      .flush(operations([], previous));
    await fixture.whenStable();
    expect(router.url).toBe(`/?kind=payments&student=s-2&month=${previous}`);

    buttonByText(hostElement(fixture), 'Все').click();
    backend
      .expectOne(matching('/api/teacher/billing/operations', { month: previous, studentId: 's-2' }))
      .flush(operations([], previous));
    await fixture.whenStable();
    expect(router.url).toBe(`/?student=s-2&month=${previous}`);
    fixture.destroy();
  });

  it('restores the month, the kind and the student after a reload or «Назад»', async () => {
    await router.navigateByUrl('/?month=2026-08&kind=payments&student=s-2');
    const fixture = TestBed.createComponent(BillingOverviewPage);
    await fixture.whenStable();
    backend.expectOne('/api/teacher/billing/overview').flush(overview([IVAN, MARIA]));
    backend
      .expectOne(matching('/api/teacher/billing/summary', { month: '2026-08' }))
      .flush(billingSummary({ month: '2026-08' }));
    backend
      .expectOne(matching('/api/teacher/billing/operations', { month: '2026-08' }))
      .flush(operations([LESSON, PAID], '2026-08'));
    await fixture.whenStable();
    backend
      .expectOne(
        matching('/api/teacher/billing/operations', {
          month: '2026-08',
          kind: 'PAYMENT',
          studentId: 's-2',
        }),
      )
      .flush(operations([PAID], '2026-08'));
    await fixture.whenStable();

    const host = hostElement(fixture);
    expect(buttonByText(host, 'Оплаты').getAttribute('aria-pressed')).toBe('true');
    expect(fixture.componentInstance.studentControl.value).toBe('s-2');
    expect(host.querySelectorAll('.tb-ops__list > li')).toHaveLength(1);
    fixture.destroy();
  });

  it('ignores a month and a kind that make no sense', async () => {
    await router.navigateByUrl('/?month=soon&kind=other');
    const fixture = TestBed.createComponent(BillingOverviewPage);
    await fixture.whenStable();
    backend.expectOne('/api/teacher/billing/overview').flush(overview([]));
    backend
      .expectOne(matching('/api/teacher/billing/summary', { month: MONTH }))
      .flush(billingSummary());
    backend
      .expectOne(matching('/api/teacher/billing/operations', { month: MONTH }))
      .flush(operations([], MONTH));
    await fixture.whenStable();
    expect(buttonByText(hostElement(fixture), 'Все').getAttribute('aria-pressed')).toBe('true');
    fixture.destroy();
  });
});
