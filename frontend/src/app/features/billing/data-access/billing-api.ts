import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
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
  RecordPaymentRequest,
  StudentLedger,
} from './billing.models';
import { quietContext } from '@core/http/api-error.interceptor';

/** HTTP client of the billing module. */
@Injectable({ providedIn: 'root' })
export class BillingApi {
  private readonly http = inject(HttpClient);

  /** Price of students and groups added from now on (minor units). */
  changeDefaultPrice(lessonPrice: number): Observable<number> {
    return this.http
      .put<{ lessonPrice: number }>('/api/teacher/billing/default-price', { lessonPrice })
      .pipe(map((response) => response.lessonPrice));
  }

  /** @param context `quietContext()` when the page shows a failed load itself (ADR-0025) */
  overview(context?: HttpContext): Observable<BillingOverview> {
    return this.http.get<BillingOverview>('/api/teacher/billing/overview', { context });
  }

  ledger(studentId: string): Observable<StudentLedger> {
    return this.http.get<StudentLedger>(`/api/teacher/billing/students/${studentId}`, {
      context: quietContext(),
    });
  }

  myLedger(): Observable<StudentLedger> {
    return this.http.get<StudentLedger>('/api/me/billing', { context: quietContext() });
  }

  /** @returns the saved price in minor units */
  changeLessonPrice(studentId: string, lessonPrice: number): Observable<number> {
    return this.http
      .put<{ lessonPrice: number }>(`/api/teacher/billing/students/${studentId}/price`, {
        lessonPrice,
      })
      .pipe(map((response) => response.lessonPrice));
  }

  /** @param context `quietContext()` when the page shows a failed load itself (ADR-0025) */
  groupPrices(context?: HttpContext): Observable<GroupPrices> {
    return this.http.get<GroupPrices>('/api/teacher/billing/groups', { context });
  }

  /** @returns the saved price in minor units */
  changeGroupPrice(groupId: string, lessonPrice: number): Observable<number> {
    return this.http
      .put<GroupPrice>(`/api/teacher/billing/groups/${groupId}/price`, { lessonPrice })
      .pipe(map((response) => response.lessonPrice));
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
      context: quietContext(),
      params: new HttpParams().set('month', month),
    });
  }

  summary(): Observable<BillingSummary> {
    return this.http.get<BillingSummary>('/api/teacher/billing/summary', {
      context: quietContext(),
    });
  }

  mySummary(): Observable<MyBillingSummary> {
    return this.http.get<MyBillingSummary>('/api/me/billing/summary', { context: quietContext() });
  }
}
