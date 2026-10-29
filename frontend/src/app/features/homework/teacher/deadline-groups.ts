import { AssignmentSummary } from '../data-access/homework.models';

export type DeadlineKey = 'overdue' | 'week' | 'later' | 'none';

export interface DeadlineGroup {
  readonly key: DeadlineKey;
  readonly rows: readonly AssignmentSummary[];
}

/** The Monday 00:00 after the week `now` falls in (weeks run Monday to Sunday, local time). */
function nextWeekStart(now: Date): number {
  const daysSinceMonday = (now.getDay() + 6) % 7;
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysSinceMonday + 7).getTime();
}

/**
 * Splits assignments by the due date: «Просрочено» (before `now`), «Срок на этой неделе» (up to the
 * next Monday), «Позже», «Без срока». Each group is ordered by the due date; empty groups are left out.
 */
export function groupByDeadline(
  rows: readonly AssignmentSummary[],
  now: Date,
): readonly DeadlineGroup[] {
  const weekEnd = nextWeekStart(now);
  const buckets: Record<DeadlineKey, AssignmentSummary[]> = {
    overdue: [],
    week: [],
    later: [],
    none: [],
  };
  for (const row of rows) {
    const due = row.dueAt === null ? null : new Date(row.dueAt).getTime();
    const key: DeadlineKey =
      due === null ? 'none' : due < now.getTime() ? 'overdue' : due < weekEnd ? 'week' : 'later';
    buckets[key].push(row);
  }
  const byDue = (a: AssignmentSummary, b: AssignmentSummary): number =>
    Date.parse(a.dueAt ?? '') - Date.parse(b.dueAt ?? '');
  return (['overdue', 'week', 'later', 'none'] as const)
    .map((key) => ({ key, rows: buckets[key].sort(byDue) }))
    .filter((group) => group.rows.length > 0);
}
