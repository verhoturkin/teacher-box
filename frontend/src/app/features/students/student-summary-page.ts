import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { Message } from 'primeng/message';
import { quietContext } from '@core/http/api-error.interceptor';
import { fromIsoDate, toIsoDate } from '@shared/dates/iso-date';
import { DateField } from '@shared/ui/date-field';
import { EmptyState } from '@shared/ui/empty-state';
import { LoadState } from '@shared/ui/load-state';
import { LoadStateView } from '@shared/ui/load-state-view';
import { PageHeader } from '@shared/ui/page-header';
import { Pane, Panes } from '@shared/ui/panes';
import { AiApi, PeriodSummaryPanel } from '@features/ai/parts';
import { HelpButton } from '@features/help/parts';
import { PeriodTasksCard } from '@features/homework/parts';
import { IdentityApi, Student } from '@features/identity/parts';
import { PeriodLessonsCard } from '@features/schedule/parts';
import { T } from './i18n/texts';

/** The longest period the AI summarises (ADR-0072); the facts follow it. */
const MAX_MONTHS = 6;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** The days of a period, both included. */
export interface Period {
  readonly from: Date;
  readonly to: Date;
}

/** The last full month before `today`: the period the page opens with. */
export function lastFullMonth(today: Date): Period {
  return {
    from: new Date(today.getFullYear(), today.getMonth() - 1, 1),
    to: new Date(today.getFullYear(), today.getMonth(), 0),
  };
}

/** `date` plus `months`, the day clamped to the end of a shorter month (as `LocalDate.plusMonths`). */
export function plusMonths(date: Date, months: number): Date {
  const first = new Date(date.getFullYear(), date.getMonth() + months, 1);
  const last = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  return new Date(first.getFullYear(), first.getMonth(), Math.min(date.getDate(), last));
}

/** Why the period cannot be summarised, as the server would refuse it; `null` — it can. */
export function periodProblem(period: Period): 'endBeforeStart' | 'tooLong' | null {
  if (period.to < period.from) {
    return 'endBeforeStart';
  }
  return period.to > plusMonths(period.from, MAX_MONTHS) ? 'tooLong' : null;
}

/**
 * «Итоги за период» of a student (ADR-0072): the period (`?from&to`, the last full month by
 * default), the facts — the lessons (schedule) and the homework (homework) of its days — and «Составить с ИИ»,
 * an editable draft to copy or print. Nothing on the page is saved or sent. Print leaves out the app frame, the
 * fields and the buttons (`styles/_print.scss`).
 */
@Component({
  selector: 'tb-student-summary-page',
  imports: [
    Button,
    Card,
    DateField,
    DatePipe,
    EmptyState,
    HelpButton,
    LoadStateView,
    Message,
    PageHeader,
    Pane,
    Panes,
    PeriodLessonsCard,
    PeriodSummaryPanel,
    PeriodTasksCard,
    ReactiveFormsModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <tb-panes
      ><tb-pane>
        <div tbPaneHeader class="tb-no-print">
          <tb-page-header
            [title]="t.title"
            [back]="['/teacher/students', studentId]"
            [backLabel]="t.back"
          >
            <tb-help-button help topic="teacher/students" />
            @if (student(); as current) {
              <span meta>{{ current.displayName }}</span>
            }
            <p-button
              [label]="t.print"
              icon="tb-i tb-i-print"
              severity="secondary"
              [disabled]="problem() !== null || student() === null"
              (onClick)="print()"
            />
          </tb-page-header>
          <div class="tb-toolbar tb-summary__period">
            <div class="tb-summary__fields">
              <div class="tb-field">
                <label for="summary-from">{{ t.from }}</label>
                <tb-date-field inputId="summary-from" [label]="t.from" [formControl]="from" />
              </div>
              <div class="tb-field">
                <label for="summary-to">{{ t.to }}</label>
                <tb-date-field inputId="summary-to" [label]="t.to" [formControl]="to" />
              </div>
            </div>
          </div>
        </div>

        <tb-load-state [state]="state" [what]="t.what" (retry)="load()">
          @if (student(); as current) {
            <h1 class="tb-print-only tb-summary__print-title">
              {{
                t.printTitle(
                  current.displayName,
                  (period().from | date: 'dd.MM.yyyy') ?? '',
                  (period().to | date: 'dd.MM.yyyy') ?? ''
                )
              }}
            </h1>
            @if (problem(); as problem) {
              <p-message severity="error" styleClass="tb-form-message">{{ t[problem] }}</p-message>
            } @else {
              <div class="tb-summary">
                <tb-period-lessons-card [studentId]="studentId" [from]="isoFrom()" [to]="isoTo()" />
                <tb-period-tasks-card [studentId]="studentId" [from]="isoFrom()" [to]="isoTo()" />
                @if (aiEnabled()) {
                  <p-card class="tb-summary__ai" [header]="t.ai">
                    <tb-period-summary-panel
                      [studentId]="studentId"
                      [from]="isoFrom()"
                      [to]="isoTo()"
                    />
                  </p-card>
                }
              </div>
            }
          } @else {
            <tb-empty-state icon="tb-i-search" [title]="t.notFoundTitle" [hint]="t.notFoundHint" />
          }
        </tb-load-state> </tb-pane
    ></tb-panes>
  `,
  styles: `
    :host {
      display: block;
      container-type: inline-size;
    }

    .tb-summary__fields {
      display: flex;
      flex-wrap: wrap;
      gap: var(--tb-space-4);
    }

    /* the facts side by side when the pane is wide, the AI under both (ours: a container query) */
    .tb-summary {
      display: grid;
      gap: var(--tb-space-6);
      align-items: start;
    }

    @container (min-width: 56rem) {
      .tb-summary {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .tb-summary__ai {
        grid-column: 1 / -1;
      }
    }

    .tb-summary__print-title {
      margin: 0 0 var(--tb-space-4);
      font: var(--tb-type-headline-s);
      letter-spacing: var(--tb-tracking-headline-s);
    }
  `,
})
export class StudentSummaryPage implements OnInit {
  protected readonly t = T.summary;
  private readonly identity = inject(IdentityApi);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly aiEnabled = toSignal(inject(AiApi).enabled$, { initialValue: false });

  protected readonly studentId = this.route.snapshot.paramMap.get('studentId') ?? '';
  protected readonly state = new LoadState();
  protected readonly student = signal<Student | null>(null);

  /** The period of the address, else the last full month. */
  readonly period = signal<Period>(this.requested());
  readonly from = new FormControl<Date | null>(this.period().from);
  readonly to = new FormControl<Date | null>(this.period().to);
  protected readonly isoFrom = computed(() => toIsoDate(this.period().from));
  protected readonly isoTo = computed(() => toIsoDate(this.period().to));
  protected readonly problem = computed(() => periodProblem(this.period()));

  ngOnInit(): void {
    this.load();
    for (const field of [this.from, this.to]) {
      field.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
        this.choose();
      });
    }
  }

  protected load(): void {
    this.identity
      .listStudents(quietContext())
      .pipe(this.state.track())
      .subscribe((students) => {
        this.student.set(students.find((student) => student.id === this.studentId) ?? null);
      });
  }

  protected print(): void {
    window.print();
  }

  /** Both days chosen: the period changes and the address keeps it (a cleared field keeps the old one). */
  private choose(): void {
    const from = this.from.value;
    const to = this.to.value;
    if (from === null || to === null) {
      return;
    }
    this.period.set({ from, to });
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { from: toIsoDate(from), to: toIsoDate(to) },
      replaceUrl: true,
    });
  }

  private requested(): Period {
    const query = this.route.snapshot.queryParamMap;
    const from = query.get('from');
    const to = query.get('to');
    return from !== null && to !== null && ISO_DATE.test(from) && ISO_DATE.test(to)
      ? { from: fromIsoDate(from), to: fromIsoDate(to) }
      : lastFullMonth(new Date());
  }
}
