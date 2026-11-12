import { DatePipe } from '@angular/common';
import { TaskSummary } from '@features/homework/data-access/homework.models';
import { T } from '@features/homework/i18n/texts';

/** The status lines of the students of an assignment, in the teacher's locale. */
export class TaskLines {
  private readonly t = T.page;

  constructor(private readonly dates: DatePipe) {}

  /** «Сдано сегодня, 09:12», «Принято вчера · оценка 4», «Отправлено на доработку 28.10», «Просрочено на 3 дня». */
  status(task: TaskSummary, dueAt: string | null): string {
    if (task.status === 'ACCEPTED' && task.reviewedAt !== null) {
      const when = this.when(task.reviewedAt);
      return task.grade === null ? this.t.acceptedOn(when) : this.t.acceptedGrade(when, task.grade);
    }
    if (task.status === 'RETURNED' && task.reviewedAt !== null) {
      return this.t.returnedOn(this.dates.transform(task.reviewedAt, 'dd.MM') ?? '');
    }
    if (task.submittedAt === null) {
      return task.overdue && dueAt !== null
        ? this.t.overdueBy(Math.max(1, daysAgo(dueAt)))
        : this.t.notSubmitted;
    }
    const days = daysAgo(task.submittedAt);
    return days === 0
      ? this.t.submittedToday(this.time(task.submittedAt))
      : days === 1
        ? this.t.submittedYesterday(this.time(task.submittedAt))
        : this.t.submittedAt(this.date(task.submittedAt));
  }

  /** A compact row's one line: the status line and the quiz score. */
  row(task: TaskSummary, dueAt: string | null): string {
    const line = this.status(task, dueAt);
    return task.quizScore !== null && task.quizMax !== null
      ? `${line} · ${this.t.quiz(task.quizScore, task.quizMax)}`
      : line;
  }

  /** «10.09.2026 15:00». */
  date(value: string): string {
    return this.dates.transform(value, 'dd.MM.yyyy HH:mm') ?? '';
  }

  private time(value: string): string {
    return this.dates.transform(value, 'HH:mm') ?? '';
  }

  private when(value: string): string {
    const days = daysAgo(value);
    return days === 0
      ? this.t.today
      : days === 1
        ? this.t.yesterday
        : (this.dates.transform(value, 'dd.MM') ?? '');
  }
}

/** Whole days from the day of `value` to today (0: today, 1: yesterday). */
function daysAgo(value: string): number {
  const day = (date: Date): number => Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.round((day(new Date()) - day(new Date(value))) / 86_400_000);
}
