import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { providePrimeNG } from 'primeng/config';
import { hostElement, readableText } from '@testing/dom';
import { myBillingSummary, payment } from '@testing/billing-fixtures';
import { MyBillingSummary } from '../data-access/billing.models';
import { MyBalanceWidget } from './my-balance-widget';

describe('MyBalanceWidget', () => {
  let fixture: ComponentFixture<MyBalanceWidget>;

  async function render(summary: MyBillingSummary): Promise<void> {
    TestBed.configureTestingModule({ imports: [MyBalanceWidget], providers: [provideRouter([]), providePrimeNG()] });
    fixture = TestBed.createComponent(MyBalanceWidget);
    fixture.componentRef.setInput('summary', summary);
    fixture.detectChanges();
    await fixture.whenStable();
  }

  afterEach(() => {
    fixture.destroy();
  });

  it('shows the debt, the price and the latest payment', async () => {
    await render(myBillingSummary({ balance: -150_000, lastPayment: payment() }));

    const text = readableText(hostElement(fixture));
    expect(text).toContain('долг 1 500 ₽');
    expect(text).toContain('Занятие стоит 1 500 ₽');
    expect(text).toContain('Последняя оплата: 5 000 ₽, 03.09.2026');
    expect(hostElement(fixture).querySelector('a')?.getAttribute('href')).toBe('/cabinet/billing');
  });

  it('does not mention payments before the first one', async () => {
    await render(myBillingSummary());

    expect(readableText(hostElement(fixture))).not.toContain('Последняя оплата');
  });
});
