import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { LessonPlan, LessonPlanInput, LessonPlanSummary, UsedPlan } from './lesson-plans.models';

const PLANS = '/api/teacher/textbooks/plans';

/** HTTP client of the teacher's lesson plans and the bank of plans (roadmap 11 «Bank»). */
@Injectable({ providedIn: 'root' })
export class LessonPlansApi {
  private readonly http = inject(HttpClient);

  /** The bank items (`bank`) with «Использовано N раз», else the working plans; the last changed first. */
  list(bank: boolean, context?: HttpContext): Observable<LessonPlanSummary[]> {
    return this.http.get<LessonPlanSummary[]>(PLANS, {
      params: bank ? { bank: 'true' } : {},
      context,
    });
  }

  get(id: string, context?: HttpContext): Observable<LessonPlan> {
    return this.http.get<LessonPlan>(`${PLANS}/${id}`, { context });
  }

  /** `bank` — a bank item from the start («Материалы» → «Создать»), else a lesson's working plan. */
  create(input: LessonPlanInput, bank: boolean): Observable<LessonPlan> {
    return this.http.post<LessonPlan>(PLANS, { ...input, bank });
  }

  /** The whole content in place of the plan's. */
  update(plan: Pick<LessonPlan, 'id' | 'version'>, input: LessonPlanInput): Observable<LessonPlan> {
    return this.http.put<LessonPlan>(`${PLANS}/${plan.id}`, { ...input, version: plan.version });
  }

  /** A bank item's copies stay, without a source. */
  remove(id: string, context?: HttpContext): Observable<void> {
    return this.http.delete(`${PLANS}/${id}`, { context }).pipe(map(() => undefined));
  }

  /** «Готово»: the first time a working plan saves its original into the bank. */
  finish(id: string): Observable<LessonPlan> {
    return this.http.post<LessonPlan>(`${PLANS}/${id}/finish`, null);
  }

  /** «Сохранить в банк» / «Обновить в банке» of a working plan. */
  saveToBank(id: string): Observable<LessonPlan> {
    return this.http.post<LessonPlan>(`${PLANS}/${id}/bank`, null);
  }

  /** «Из банка»: a working copy of a bank item for the lesson; `schedule` puts it on the lesson. */
  use(id: string, lessonId: string): Observable<UsedPlan> {
    return this.http.post<UsedPlan>(`${PLANS}/${id}/use`, { lessonId });
  }
}
