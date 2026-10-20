import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ledger, lesson, payment } from '@testing/billing-fixtures';
import { hostElement, readableText } from '@testing/dom';
import { testProviders } from '@testing/setup';
import { StudentLedger } from '../data-access/billing.models';
import { StudentBalanceCard } from './student-balance-card';

describe('StudentBalanceCard', () => {
  let fixture: ComponentFixture<StudentBalanceCard>;
  let backend: HttpTestingController;

  async function render(): Promise<void> {
    TestBed.configureTestingModule({ imports: [StudentBalanceCard], providers: testProviders() });
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(StudentBalanceCard);
    fixture.componentRef.setInput('studentId', 's-1');
    await fixture.whenStable();
  }

  async function answer(read: StudentLedger): Promise<void> {
    backend.expectOne('/api/teacher/billing/students/s-1').flush(read);
    await fixture.whenStable();
  }

  function text(): string {
    return readableText(hostElement(fixture)).replace(/\s/g, ' ');
  }

  afterEach(() => {
    fixture.destroy();
    backend.verify();
  });

  it('shows the balance, the price and the last counted operations', async () => {
    await render();
    await answer(
      ledger({
        balance: -150_000,
        lessons: [
          lesson({ id: 'l-1', date: '2026-10-19' }),
          lesson({ id: 'l-2', date: '2026-10-18', status: 'CANCELLED' }),
          lesson({ id: 'l-3', date: '2026-10-01' }),
        ],
        payments: [
          payment({ id: 'p-1', paidOn: '2026-10-12', amount: 600_000 }),
          payment({ id: 'p-2', paidOn: '2026-10-15', voidedAt: '2026-10-16T10:00:00Z' }),
        ],
      }),
    );

    expect(text()).toContain('долг 1 500 ₽');
    expect(text()).toContain('Цена занятия 1 500 ₽');
    const rows = Array.from(hostElement(fixture).querySelectorAll('li')).map((row) =>
      readableText(row).replace(/\s/g, ' '),
    );
    expect(rows).toEqual([
      'Занятие 19.10.2026 −1 500 ₽',
      'Оплата 12.10.2026 +6 000 ₽',
      'Занятие 01.10.2026 −1 500 ₽',
    ]);
  });

  it('shows no operations before the first one and reads again on a new revision', async () => {
    await render();
    await answer(ledger({ balance: 0, lessons: [], payments: [] }));
    expect(text()).toContain('0 ₽');
    expect(hostElement(fixture).querySelector('ul')).toBeNull();

    fixture.componentRef.setInput('revision', 1);
    await fixture.whenStable();
    await answer(ledger({ balance: 500_000, lessons: [], payments: [payment()] }));
    expect(text()).toContain('аванс 5 000 ₽');
  });
});
