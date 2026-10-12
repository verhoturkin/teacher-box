import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import type { Mock } from 'vitest';
import { FileOpener } from '@shared/files/file-opener';
import { testProviders } from '@testing/setup';
import { providePrimeNG } from 'primeng/config';
import { ledger, lesson, payment } from '@testing/billing-fixtures';
import { bodyText, buttonByText, hostElement, menuItemByText, requireElement } from '@testing/dom';
import { Lesson, Payment } from '../data-access/billing.models';
import { BalanceAmount } from './balance-amount';
import { ledgerEntries } from './ledger-entries';
import { LEDGER_PAGE, LedgerList } from './ledger-list';

function normalize(text: string): string {
  return text.replace(/\s+/g, ' ');
}

describe('ledgerEntries', () => {
  it('merges lessons and payments newest first', () => {
    const entries = ledgerEntries(
      ledger({
        lessons: [
          lesson({ id: 'old', date: '2026-09-01' }),
          lesson({ id: 'late', date: '2026-09-05', status: 'CANCELLED' }),
        ],
        payments: [payment({ id: 'pay', paidOn: '2026-09-03', voidedAt: '2026-09-04T00:00:00Z' })],
      }),
    );

    expect(entries.map((entry) => entry.id)).toEqual(['late', 'pay', 'old']);
    expect(entries.map((entry) => entry.inactive)).toEqual([true, true, false]);
  });

  it('orders entries of the same day by creation time', () => {
    const entries = ledgerEntries(
      ledger({
        lessons: [lesson({ id: 'first', createdAt: '2026-09-01T10:00:00Z' })],
        payments: [
          payment({ id: 'second', paidOn: '2026-09-01', createdAt: '2026-09-01T12:00:00Z' }),
        ],
      }),
    );

    expect(entries.map((entry) => entry.id)).toEqual(['second', 'first']);
  });
});

describe('LedgerList', () => {
  let fixture: ComponentFixture<LedgerList>;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [LedgerList], providers: [providePrimeNG()] });
    fixture = TestBed.createComponent(LedgerList);
  });

  function rows(): string[] {
    return Array.from(hostElement(fixture).querySelectorAll('.tb-list > li')).map((row) =>
      normalize(row.textContent),
    );
  }

  it('shows charges and payments read-only', async () => {
    fixture.componentRef.setInput(
      'ledger',
      ledger({
        lessons: [
          lesson({ id: 'l1', date: '2026-09-01' }),
          lesson({ id: 'l2', date: '2026-09-02', status: 'MISSED', topic: null }),
          lesson({ id: 'l3', date: '2026-09-04', status: 'CANCELLED', cancelReason: 'болел' }),
        ],
        payments: [
          payment({ paidOn: '2026-09-03', voidedAt: '2026-09-03T12:00:00Z', voidReason: 'ошибка' }),
        ],
      }),
    );
    await fixture.whenStable();

    const text = rows();
    expect(text[0]).toContain('04.09.2026');
    expect(text[0]).toContain('Отменено');
    expect(text[0]).toContain('04.09.2026 · Дроби (болел)');
    expect(text[1]).toContain('Оплата');
    expect(text[1]).not.toContain('Перевод');
    expect(text[1]).toContain('Аннулирована');
    expect(text[1]).toContain('+5 000 ₽');
    expect(text[2]).toContain('Пропуск');
    expect(
      hostElement(fixture).querySelector('p-tag[title="Пропуск (оплачивается)"]'),
    ).not.toBeNull();
    expect(text[3]).toContain('Дроби');
    expect(text[3]).toContain('−1 500 ₽');
    expect(hostElement(fixture).querySelectorAll('.tb-list > li.tb-inactive')).toHaveLength(2);
    expect(hostElement(fixture).querySelector('button')).toBeNull();
  });

  it('lets the teacher cancel lessons and void payments', async () => {
    const cancelled: Lesson[] = [];
    const voided: Payment[] = [];
    fixture.componentInstance.cancelLesson.subscribe((value) => cancelled.push(value));
    fixture.componentInstance.voidPayment.subscribe((value) => voided.push(value));
    fixture.componentRef.setInput('ledger', ledger());
    fixture.componentRef.setInput('editable', true);
    await fixture.whenStable();

    requireElement(
      hostElement(fixture),
      'button[aria-label^="Снять начисление за "]',
      HTMLButtonElement,
    ).click();
    requireElement(
      hostElement(fixture),
      'button[aria-label^="Аннулировать оплату от "]',
      HTMLButtonElement,
    ).click();

    expect(cancelled.map((value) => value.id)).toEqual(['l-1']);
    expect(voided.map((value) => value.id)).toEqual(['p-1']);
  });

  it('shows the history by pages', async () => {
    const lessons = Array.from({ length: LEDGER_PAGE + 5 }, (_, index) =>
      lesson({
        id: `l-${String(index)}`,
        createdAt: `2026-09-01T10:${String(index).padStart(2, '0')}:00Z`,
      }),
    );
    fixture.componentRef.setInput('ledger', ledger({ lessons, payments: [] }));
    await fixture.whenStable();
    expect(rows()).toHaveLength(LEDGER_PAGE);

    buttonByText(hostElement(fixture), 'Показать ещё').click();
    await fixture.whenStable();

    expect(rows()).toHaveLength(LEDGER_PAGE + 5);
    expect(hostElement(fixture).textContent).not.toContain('Показать ещё');
  });

  it('shows an empty state', async () => {
    fixture.componentRef.setInput('ledger', ledger({ lessons: [], payments: [] }));
    fixture.componentRef.setInput('editable', true);
    await fixture.whenStable();

    expect(hostElement(fixture).textContent).toContain('Пока нет ни занятий, ни оплат');
  });
});

describe('BalanceAmount', () => {
  it('describes debt, prepayment and zero', async () => {
    TestBed.configureTestingModule({ imports: [BalanceAmount] });
    const fixture = TestBed.createComponent(BalanceAmount);
    fixture.componentRef.setInput('currency', 'RUB');

    fixture.componentRef.setInput('balance', -150_000);
    await fixture.whenStable();
    expect(normalize(hostElement(fixture).textContent)).toContain('долг 1 500 ₽');
    expect(hostElement(fixture).querySelector('.tb-negative')).not.toBeNull();

    fixture.componentRef.setInput('balance', 50_000);
    await fixture.whenStable();
    expect(normalize(hostElement(fixture).textContent)).toContain('аванс 500 ₽');

    fixture.componentRef.setInput('balance', 0);
    await fixture.whenStable();
    expect(hostElement(fixture).querySelector('.tb-muted')?.textContent.trim()).toBe('0 ₽');
  });
});

describe('LedgerList receipts', () => {
  let fixture: ComponentFixture<LedgerList>;
  let backend: HttpTestingController;
  let opener: { open: Mock<FileOpener['open']> };

  const RECEIPT = { filename: 'чек.pdf', contentType: 'application/pdf', size: 10 };

  beforeEach(() => {
    opener = { open: vi.fn<FileOpener['open']>() };
    TestBed.configureTestingModule({
      imports: [LedgerList],
      providers: [...testProviders(), { provide: FileOpener, useValue: opener }],
    });
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(LedgerList);
  });

  afterEach(() => {
    backend.verify();
    fixture.destroy();
  });

  function opened(call: number): Parameters<FileOpener['open']> {
    const args = opener.open.mock.calls[call];
    if (args === undefined) {
      throw new Error(`The file opener was not called ${String(call + 1)} times`);
    }
    return args;
  }

  it('opens the receipt of an own payment for the student', async () => {
    fixture.componentRef.setInput(
      'ledger',
      ledger({ payments: [payment({ receipt: RECEIPT }), payment({ id: 'p-2' })] }),
    );
    await fixture.whenStable();
    const host = hostElement(fixture);

    expect(host.querySelectorAll('button[aria-label^="Открыть чек оплаты от "]')).toHaveLength(1);
    expect(host.querySelector('button[aria-label^="Чек оплаты от "]')).toBeNull();
    requireElement(host, 'button[aria-label^="Открыть чек оплаты от "]', HTMLButtonElement).click();

    const [content, showable, filename] = opened(0);
    expect(showable).toBe(true);
    expect(filename(new Blob())).toBe('чек.pdf');
    content.subscribe();
    backend.expectOne('/api/me/billing/payments/p-1/receipt').flush(new Blob(['%PDF']));
  });

  it('lets the teacher attach, replace and remove a receipt from the menu', async () => {
    const attached: { payment: Payment; file: File }[] = [];
    const removed: Payment[] = [];
    fixture.componentInstance.attachReceipt.subscribe((event) => attached.push(event));
    fixture.componentInstance.removeReceipt.subscribe((value) => removed.push(value));
    fixture.componentRef.setInput('editable', true);
    fixture.componentRef.setInput(
      'ledger',
      ledger({
        payments: [
          payment({ id: 'with', receipt: { ...RECEIPT, contentType: 'image/heic' } }),
          payment({ id: 'without', paidOn: '2026-09-01' }),
        ],
      }),
    );
    await fixture.whenStable();
    const host = hostElement(fixture);
    const menus = host.querySelectorAll<HTMLButtonElement>('button[aria-label^="Чек оплаты от "]');
    expect(menus).toHaveLength(2);

    requireElement(host, 'button[aria-label^="Открыть чек оплаты от "]', HTMLButtonElement).click();
    const [content, showable] = opened(0);
    expect(showable).toBe(false);
    content.subscribe();
    backend.expectOne('/api/teacher/billing/payments/with/receipt').flush(new Blob(['x']));

    menus[0]?.click();
    await fixture.whenStable();
    expect(bodyText()).toContain('Заменить чек');
    menuItemByText('Убрать чек').click();
    expect(removed.map((value) => value.id)).toEqual(['with']);

    menus[1]?.click();
    await fixture.whenStable();
    const picker = requireElement(host, 'input[type="file"]', HTMLInputElement);
    const click = vi.spyOn(picker, 'click').mockImplementation(() => undefined);
    menuItemByText('Прикрепить чек').click();
    expect(click).toHaveBeenCalled();
    const file = new File(['%PDF'], 'check.pdf', { type: 'application/pdf' });
    Object.defineProperty(picker, 'files', { value: [file], configurable: true });
    picker.dispatchEvent(new Event('change'));

    expect(attached.map((event) => [event.payment.id, event.file])).toEqual([['without', file]]);
    Object.defineProperty(picker, 'files', { value: [], configurable: true });
    picker.dispatchEvent(new Event('change'));
    expect(attached).toHaveLength(1);
  });
});
