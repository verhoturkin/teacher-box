import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { BillingApi } from './billing-api';

describe('BillingApi', () => {
  let api: BillingApi;
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    api = TestBed.inject(BillingApi);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    backend.verify();
  });

  it('reads balances, histories and reports', () => {
    api.overview().subscribe();
    api.ledger('s-1').subscribe();
    api.myLedger().subscribe();
    api.monthlyReport('2026-09').subscribe();

    backend.expectOne('/api/teacher/billing/overview');
    backend.expectOne('/api/teacher/billing/students/s-1');
    backend.expectOne('/api/me/billing');
    backend.expectOne('/api/teacher/billing/reports/monthly?month=2026-09');
  });

  it('records lessons and payments', () => {
    const lessonRequest = {
      studentId: 's-1',
      date: '2026-09-01',
      durationMinutes: 60,
      price: 150_000,
      topic: null,
      status: 'CONDUCTED' as const,
    };
    const paymentRequest = {
      studentId: 's-1',
      amount: 100,
      paidOn: '2026-09-01',
      method: 'CASH' as const,
      comment: null,
    };
    api.recordLesson(lessonRequest).subscribe();
    api.recordPayment(paymentRequest).subscribe();
    api.cancelLesson('l-1', 'болел').subscribe();
    api.voidPayment('p-1', null).subscribe();

    expect(backend.expectOne('/api/teacher/billing/lessons').request.body).toEqual(lessonRequest);
    expect(backend.expectOne('/api/teacher/billing/payments').request.body).toEqual(paymentRequest);
    expect(backend.expectOne('/api/teacher/billing/lessons/l-1/cancel').request.body).toEqual({ reason: 'болел' });
    expect(backend.expectOne('/api/teacher/billing/payments/p-1/void').request.body).toEqual({ reason: null });
  });

  it('changes the lesson price', () => {
    let saved = 0;
    api.changeLessonPrice('s-1', 200_000).subscribe((price) => {
      saved = price;
    });

    const request = backend.expectOne('/api/teacher/billing/students/s-1/price');
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({ lessonPrice: 200_000 });
    request.flush({ studentId: 's-1', lessonPrice: 200_000 });

    expect(saved).toBe(200_000);
  });
});
