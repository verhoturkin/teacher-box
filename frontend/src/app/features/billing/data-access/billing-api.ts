import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import {
  BillingOverview,
  BillingSummary,
  GroupPrice,
  GroupPrices,
  Lesson,
  MonthlyReport,
  MyBillingSummary,
  Payment,
  RecordLessonRequest,
  RecordPaymentRequest,
  StudentLedger,
} from './billing.models';

/** HTTP client of the billing module. */
@Injectable({ providedIn: 'root' })
export class BillingApi {
  private readonly http = inject(HttpClient);

  overview(): Observable<BillingOverview> {
    return this.http.get<BillingOverview>('/api/teacher/billing/overview');
  }

  ledger(studentId: string): Observable<StudentLedger> {
    return this.http.get<StudentLedger>(`/api/teacher/billing/students/${studentId}`);
  }

  myLedger(): Observable<StudentLedger> {
    return this.http.get<StudentLedger>('/api/me/billing');
  }

  /** @returns the saved price in minor units */
  changeLessonPrice(studentId: string, lessonPrice: number): Observable<number> {
    return this.http
      .put<{ lessonPrice: number }>(`/api/teacher/billing/students/${studentId}/price`, { lessonPrice })
      .pipe(map((response) => response.lessonPrice));
  }

  groupPrices(): Observable<GroupPrices> {
    return this.http.get<GroupPrices>('/api/teacher/billing/groups');
  }

  /** @returns the saved price in minor units */
  changeGroupPrice(groupId: string, lessonPrice: number): Observable<number> {
    return this.http
      .put<GroupPrice>(`/api/teacher/billing/groups/${groupId}/price`, { lessonPrice })
      .pipe(map((response) => response.lessonPrice));
  }

  recordLesson(request: RecordLessonRequest): Observable<Lesson> {
    return this.http.post<Lesson>('/api/teacher/billing/lessons', request);
  }

  cancelLesson(lessonId: string, reason: string | null): Observable<Lesson> {
    return this.http.post<Lesson>(`/api/teacher/billing/lessons/${lessonId}/cancel`, { reason });
  }

  recordPayment(request: RecordPaymentRequest): Observable<Payment> {
    return this.http.post<Payment>('/api/teacher/billing/payments', request);
  }

  voidPayment(paymentId: string, reason: string | null): Observable<Payment> {
    return this.http.post<Payment>(`/api/teacher/billing/payments/${paymentId}/void`, { reason });
  }

  /** @param month `yyyy-MM` */
  monthlyReport(month: string): Observable<MonthlyReport> {
    return this.http.get<MonthlyReport>('/api/teacher/billing/reports/monthly', {
      params: new HttpParams().set('month', month),
    });
  }

  summary(): Observable<BillingSummary> {
    return this.http.get<BillingSummary>('/api/teacher/billing/summary');
  }

  mySummary(): Observable<MyBillingSummary> {
    return this.http.get<MyBillingSummary>('/api/me/billing/summary');
  }
}
