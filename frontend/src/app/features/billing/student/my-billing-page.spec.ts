import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ledger } from '@testing/billing-fixtures';
import { buttonByText, hostElement, readableText } from '@testing/dom';
import { StudentLedger } from '../data-access/billing.models';
import { MyBillingPage } from './my-billing-page';
import { testProviders } from '@testing/setup';

describe('MyBillingPage', () => {
  async function render(data: StudentLedger): Promise<string> {
    TestBed.configureTestingModule({
      imports: [MyBillingPage],
      providers: testProviders(),
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

  it('shows a failed load with «Повторить»', async () => {
    TestBed.configureTestingModule({ imports: [MyBillingPage], providers: testProviders() });
    const backend = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(MyBillingPage);
    await fixture.whenStable();
    backend.expectOne('/api/me/billing').flush(null, { status: 0, statusText: 'Unknown Error' });
    await fixture.whenStable();
    const host = hostElement(fixture);

    expect(readableText(host)).toContain('Не удалось загрузить оплаты');

    buttonByText(host, 'Повторить').click();
    backend.expectOne('/api/me/billing').flush(ledger({ balance: 0 }));
    await fixture.whenStable();

    expect(readableText(host)).toContain('Всё оплачено');
  });
});
