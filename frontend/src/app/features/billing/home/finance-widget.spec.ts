import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { providePrimeNG } from 'primeng/config';
import { hostElement, readableText } from '@testing/dom';
import { billingSummary } from '@testing/billing-fixtures';
import { BillingSummary } from '../data-access/billing.models';
import { FinanceWidget } from './finance-widget';

describe('FinanceWidget', () => {
  let fixture: ComponentFixture<FinanceWidget>;

  async function render(summary: BillingSummary): Promise<void> {
    TestBed.configureTestingModule({ imports: [FinanceWidget], providers: [provideRouter([]), providePrimeNG()] });
    fixture = TestBed.createComponent(FinanceWidget);
    fixture.componentRef.setInput('summary', summary);
    fixture.detectChanges();
    await fixture.whenStable();
  }

  afterEach(() => {
    fixture.destroy();
  });

  it('shows the income of the month and the largest debts', async () => {
    await render(
      billingSummary({
        income: 1_200_000,
        totalDebt: 450_000,
        debtors: 2,
        topDebtors: [
          { studentId: 's-1', displayName: 'Анна', balance: -300_000 },
          { studentId: 's-2', displayName: 'Борис', balance: -150_000 },
        ],
      }),
    );

    const text = readableText(hostElement(fixture));
    expect(text).toContain('Поступило за сентябрь 12 000 ₽');
    expect(text).toContain('Долг учеников 4 500 ₽ должников: 2');
    expect(text).toContain('Анна 3 000 ₽ Борис 1 500 ₽');
    const links = Array.from(hostElement(fixture).querySelectorAll('a')).map((a) => a.getAttribute('href'));
    expect(links).toEqual(['/teacher/billing/students/s-1', '/teacher/billing/students/s-2', '/teacher/billing']);
  });

  it('shows no debtors when everything is paid', async () => {
    await render(billingSummary());

    const text = readableText(hostElement(fixture));
    expect(text).toContain('Долг учеников 0 ₽');
    expect(text).not.toContain('должников');
  });
});
