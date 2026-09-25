import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { providePrimeNG } from 'primeng/config';
import { toIsoMonth } from '@shared/dates/iso-date';
import { monthlyReport } from '@testing/billing-fixtures';
import { hostElement, readableText } from '@testing/dom';
import { MonthlyReportPage } from './monthly-report-page';

describe('MonthlyReportPage', () => {
  let fixture: ComponentFixture<MonthlyReportPage>;
  let backend: HttpTestingController;
  let host: HTMLElement;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [MonthlyReportPage],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([]), providePrimeNG()],
    });
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(MonthlyReportPage);
    host = hostElement(fixture);
    await fixture.whenStable();
  });

  afterEach(() => {
    backend.verify();
    fixture.destroy();
  });

  function text(): string {
    return readableText(host);
  }

  it('loads the current month', async () => {
    backend
      .expectOne(`/api/teacher/billing/reports/monthly?month=${toIsoMonth(new Date())}`)
      .flush(monthlyReport());
    await fixture.whenStable();

    expect(text()).toContain('Поступления 5 000 ₽');
    expect(text()).toContain('Начислено за занятия 3 000 ₽');
    expect(text()).toContain('пропусков: 1, отменено: 1');
    expect(text()).toContain('Проведено');
    expect(text()).toContain('Пропуск (оплачивается)');
    expect(text()).toContain('Перевод');
    expect(host.querySelectorAll('tr.tb-inactive')).toHaveLength(1);
  });

  it('reloads when another month is chosen and shows empty states', async () => {
    backend.expectOne(() => true).flush(monthlyReport());
    await fixture.whenStable();

    fixture.componentInstance.month.setValue(new Date(2025, 2, 1));

    backend
      .expectOne('/api/teacher/billing/reports/monthly?month=2025-03')
      .flush(monthlyReport({ month: '2025-03', students: [], lessons: [], payments: [] }));
    await fixture.whenStable();

    expect(text()).toContain('В этом месяце не было ни занятий, ни оплат');
    expect(text()).toContain('Занятий нет');
    expect(text()).toContain('Оплат нет');
  });
});
