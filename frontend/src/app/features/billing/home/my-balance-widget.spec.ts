import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { providePrimeNG } from 'primeng/config';
import { hostElement, readableText } from '@testing/dom';
import { myBillingSummary } from '@testing/billing-fixtures';
import { MyBillingSummary } from '../data-access/billing.models';
import { MyBalanceWidget } from './my-balance-widget';

describe('MyBalanceWidget', () => {
  let fixture: ComponentFixture<MyBalanceWidget>;

  async function render(summary: MyBillingSummary): Promise<void> {
    TestBed.configureTestingModule({
      imports: [MyBalanceWidget],
      providers: [provideRouter([]), providePrimeNG()],
    });
    fixture = TestBed.createComponent(MyBalanceWidget);
    fixture.componentRef.setInput('summary', summary);
    fixture.detectChanges();
    await fixture.whenStable();
  }

  afterEach(() => {
    fixture.destroy();
  });

  it('divides the balance by the price: the paid lessons, the balance and the bar', async () => {
    await render(myBillingSummary({ balance: 450_000 }));

    const host = hostElement(fixture);
    const text = readableText(host);
    expect(text).toContain('Оплачено');
    expect(text).toContain('3 занятия');
    expect(text).toContain('4 500 ₽ на балансе');
    expect(host.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow')).toBe('3');
    expect(host.querySelector('a')?.getAttribute('href')).toBe('/cabinet/billing');
  });

  it('fills the bar at eight lessons and no further', async () => {
    await render(myBillingSummary({ balance: 150_000 * 12 }));

    expect(
      hostElement(fixture).querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow'),
    ).toBe('8');
    expect(readableText(hostElement(fixture))).toContain('12 занятий');
  });

  it('shows the debt without the lessons', async () => {
    await render(myBillingSummary({ balance: -150_000 }));

    const host = hostElement(fixture);
    expect(readableText(host)).toContain('Долг 1 500 ₽');
    expect(host.querySelector('[role="progressbar"]')).toBeNull();
  });

  it('shows the balance alone when the lesson has no price', async () => {
    await render(myBillingSummary({ balance: 50_000, lessonPrice: 0 }));

    const text = readableText(hostElement(fixture));
    expect(text).toContain('500 ₽');
    expect(text).not.toContain('занят');
  });
});
