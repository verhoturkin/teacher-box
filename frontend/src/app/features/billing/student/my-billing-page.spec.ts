import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { providePrimeNG } from 'primeng/config';
import { ledger } from '@testing/billing-fixtures';
import { hostElement, readableText } from '@testing/dom';
import { StudentLedger } from '../data-access/billing.models';
import { MyBillingPage } from './my-billing-page';

describe('MyBillingPage', () => {
  async function render(data: StudentLedger): Promise<string> {
    TestBed.configureTestingModule({
      imports: [MyBillingPage],
      providers: [provideHttpClient(), provideHttpClientTesting(), providePrimeNG()],
    });
    const fixture = TestBed.createComponent(MyBillingPage);
    await fixture.whenStable();
    TestBed.inject(HttpTestingController).expectOne('/api/me/billing').flush(data);
    await fixture.whenStable();
    return readableText(hostElement(fixture));
  }

  it('explains a debt', async () => {
    const text = await render(ledger({ balance: -150_000 }));

    expect(text).toContain('долг 1 500 ₽');
    expect(text).toContain('Столько нужно оплатить');
    expect(text).toContain('Стоимость занятия 1 500 ₽');
    expect(text).not.toContain('Отменить занятие');
  });

  it('explains a prepayment', async () => {
    expect(await render(ledger({ balance: 50_000 }))).toContain('пойдёт в счёт следующих занятий');
  });

  it('confirms that everything is paid', async () => {
    expect(await render(ledger({ balance: 0 }))).toContain('Всё оплачено');
  });
});
