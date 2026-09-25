import { ComponentFixture, TestBed } from '@angular/core/testing';
import { providePrimeNG } from 'primeng/config';
import { ledger, lesson, payment } from '@testing/billing-fixtures';
import { buttonByText, hostElement } from '@testing/dom';
import { Lesson, Payment } from '../data-access/billing.models';
import { BalanceAmount } from './balance-amount';
import { ledgerEntries } from './ledger-entries';
import { LedgerTable } from './ledger-table';

function normalize(text: string): string {
  return text.replace(/\s+/g, ' ');
}

describe('ledgerEntries', () => {
  it('merges lessons and payments newest first', () => {
    const entries = ledgerEntries(
      ledger({
        lessons: [lesson({ id: 'old', date: '2026-09-01' }), lesson({ id: 'late', date: '2026-09-05', status: 'CANCELLED' })],
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
        payments: [payment({ id: 'second', paidOn: '2026-09-01', createdAt: '2026-09-01T12:00:00Z' })],
      }),
    );

    expect(entries.map((entry) => entry.id)).toEqual(['second', 'first']);
  });
});

describe('LedgerTable', () => {
  let fixture: ComponentFixture<LedgerTable>;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [LedgerTable], providers: [providePrimeNG()] });
    fixture = TestBed.createComponent(LedgerTable);
  });

  function rows(): string[] {
    return Array.from(hostElement(fixture).querySelectorAll('tbody tr')).map((row) => normalize(row.textContent));
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
        payments: [payment({ paidOn: '2026-09-03', voidedAt: '2026-09-03T12:00:00Z', voidReason: 'ошибка' })],
      }),
    );
    await fixture.whenStable();

    const text = rows();
    expect(text[0]).toContain('04.09.2026');
    expect(text[0]).toContain('Отменено');
    expect(text[0]).toContain('(болел)');
    expect(text[1]).toContain('Оплата: Перевод');
    expect(text[1]).toContain('Аннулирована');
    expect(text[1]).toContain('+5 000 ₽');
    expect(text[2]).toContain('Пропуск (оплачивается)');
    expect(text[3]).toContain('Дроби');
    expect(text[3]).toContain('−1 500 ₽');
    expect(hostElement(fixture).querySelectorAll('tbody tr.tb-inactive')).toHaveLength(2);
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

    buttonByText(hostElement(fixture), 'Отменить занятие').click();
    buttonByText(hostElement(fixture), 'Аннулировать оплату').click();

    expect(cancelled.map((value) => value.id)).toEqual(['l-1']);
    expect(voided.map((value) => value.id)).toEqual(['p-1']);
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
    expect(hostElement(fixture).querySelector('.tb-muted')?.textContent.trim()).toBe('0');
  });
});
