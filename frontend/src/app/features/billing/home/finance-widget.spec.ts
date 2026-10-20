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
    TestBed.configureTestingModule({
      imports: [FinanceWidget],
      providers: [provideRouter([]), providePrimeNG()],
    });
    fixture = TestBed.createComponent(FinanceWidget);
    fixture.componentRef.setInput('summary', summary);
    fixture.detectChanges();
    await fixture.whenStable();
  }

  afterEach(() => {
    fixture.destroy();
  });

  it('shows the month as the title, the income and the debt', async () => {
    await render(billingSummary({ income: 1_200_000, totalDebt: 450_000, debtors: 2 }));

    const text = readableText(hostElement(fixture));
    expect(text).toContain('Сентябрь');
    expect(text).toContain('Поступило 12 000 ₽');
    expect(text).toContain('Долг 4 500 ₽ должников: 2');
    expect(hostElement(fixture).querySelector('a')).toBeNull();
  });

  it('shows no debtors when everything is paid', async () => {
    await render(billingSummary());

    const text = readableText(hostElement(fixture));
    expect(text).toContain('Долг 0 ₽');
    expect(text).not.toContain('должников');
  });
});
