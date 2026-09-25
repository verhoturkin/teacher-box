import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { MessageService } from 'primeng/api';
import { providePrimeNG } from 'primeng/config';
import { lesson, overview, payment, studentBalance } from '@testing/billing-fixtures';
import { buttonByText, hostElement, readableText, requireElement } from '@testing/dom';
import { BillingOverviewPage } from './billing-overview-page';
import { LessonDialog } from './lesson-dialog';
import { PaymentDialog } from './payment-dialog';

const IVAN = studentBalance({
  studentId: 's-1',
  displayName: 'Иван',
  balance: -150_000,
  chargedLessons: 3,
  lastLessonDate: '2026-09-01',
});
const MARIA = studentBalance({ studentId: 's-2', displayName: 'Мария', balance: 300_000 });
const OLEG = studentBalance({ studentId: 's-3', displayName: 'Олег', status: 'DEACTIVATED' });

describe('BillingOverviewPage', () => {
  let fixture: ComponentFixture<BillingOverviewPage>;
  let backend: HttpTestingController;
  let host: HTMLElement;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [BillingOverviewPage],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        providePrimeNG(),
        MessageService,
      ],
    });
    backend = TestBed.inject(HttpTestingController);
    vi.spyOn(TestBed.inject(MessageService), 'add');
    fixture = TestBed.createComponent(BillingOverviewPage);
    host = hostElement(fixture);
    await fixture.whenStable();
    backend.expectOne('/api/teacher/billing/overview').flush(overview([IVAN, MARIA, OLEG]));
    await fixture.whenStable();
  });

  afterEach(() => {
    backend.verify();
    fixture.destroy();
  });

  function normalizedText(): string {
    return readableText(host);
  }

  function rows(): string[] {
    return Array.from(host.querySelectorAll('tbody tr')).map((row) => readableText(row));
  }

  it('shows totals and balances', () => {
    expect(normalizedText()).toContain('Долг учеников 1 500 ₽');
    expect(normalizedText()).toContain('Авансы 3 000 ₽');
    expect(normalizedText()).toContain('Должников 1');
    expect(rows()).toHaveLength(3);
    expect(rows()[0]).toContain('Иван');
    expect(rows()[0]).toContain('01.09.2026');
    expect(rows()[0]).toContain('долг 1 500 ₽');
    expect(rows()[1]).toContain('аванс 3 000 ₽');
    expect(rows()[2]).toContain('(отключён)');
  });

  it('filters debtors', async () => {
    requireElement(host, '#only-debtors', HTMLInputElement).click();
    await fixture.whenStable();

    expect(rows()).toHaveLength(1);
    expect(rows()[0]).toContain('Иван');
  });

  it('records a lesson for a student and reloads', async () => {
    buttonByText(host, 'Занятие: Иван').click();
    await fixture.whenStable();
    const dialog = fixture.debugElement.query(By.directive(LessonDialog)).injector.get(LessonDialog);
    expect(dialog.visible()).toBe(true);
    expect(dialog.form.controls.studentId.value).toBe('s-1');
    expect(dialog.students().map((student) => student.studentId)).toEqual(['s-1', 's-2']);

    dialog.save();
    backend.expectOne('/api/teacher/billing/lessons').flush(lesson());
    await fixture.whenStable();

    expect(TestBed.inject(MessageService).add).toHaveBeenCalledWith(
      expect.objectContaining({ detail: 'Занятие записано' }),
    );
    backend.expectOne('/api/teacher/billing/overview').flush(overview([IVAN]));
  });

  it('opens the payment dialog from the toolbar and for a student', async () => {
    buttonByText(host, 'Оплата').click();
    await fixture.whenStable();
    const dialog = fixture.debugElement.query(By.directive(PaymentDialog)).injector.get(PaymentDialog);
    expect(dialog.visible()).toBe(true);
    expect(dialog.form.controls.studentId.value).toBeNull();

    dialog.visible.set(false);
    await fixture.whenStable();
    buttonByText(host, 'Оплата: Мария').click();
    await fixture.whenStable();
    expect(dialog.form.controls.studentId.value).toBe('s-2');

    dialog.form.patchValue({ amount: 100 });
    dialog.save();
    backend.expectOne('/api/teacher/billing/payments').flush(payment());
    backend.expectOne('/api/teacher/billing/overview').flush(overview([]));
    await fixture.whenStable();

    expect(normalizedText()).toContain('Добавьте учеников');
  });

  it('opens the lesson dialog from the toolbar', async () => {
    buttonByText(host, 'Занятие').click();
    await fixture.whenStable();

    const dialog = fixture.debugElement.query(By.directive(LessonDialog)).injector.get(LessonDialog);
    expect(dialog.visible()).toBe(true);
    expect(dialog.form.controls.studentId.value).toBeNull();
  });
});
