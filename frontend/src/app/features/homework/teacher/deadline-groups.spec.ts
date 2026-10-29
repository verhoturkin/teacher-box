import { assignmentSummary } from '@testing/homework-fixtures';
import { groupByDeadline } from './deadline-groups';

/** Wednesday 2 September 2026, noon; the week ends on Monday 7 September 00:00 (local time). */
const NOW = new Date(2026, 8, 2, 12);

function due(id: string, at: Date | null) {
  return assignmentSummary({ id, dueAt: at === null ? null : at.toISOString() });
}

function keys(...rows: ReturnType<typeof due>[]): Record<string, string[]> {
  return Object.fromEntries(
    groupByDeadline(rows, NOW).map((group) => [group.key, group.rows.map((row) => row.id)]),
  );
}

describe('groupByDeadline', () => {
  it('splits by the due date at the edges of the week', () => {
    expect(
      keys(
        due('passed', new Date(2026, 8, 2, 11, 59)),
        due('now-on', new Date(2026, 8, 2, 12)),
        due('sunday', new Date(2026, 8, 6, 23, 59)),
        due('monday', new Date(2026, 8, 7, 0, 0)),
        due('none', null),
      ),
    ).toEqual({
      overdue: ['passed'],
      week: ['now-on', 'sunday'],
      later: ['monday'],
      none: ['none'],
    });
  });

  it('orders each group by the due date and leaves out the empty ones', () => {
    expect(
      keys(due('b', new Date(2026, 8, 5)), due('a', new Date(2026, 8, 3)), due('c', null)),
    ).toEqual({ week: ['a', 'b'], none: ['c'] });
    expect(groupByDeadline([], NOW)).toEqual([]);
  });

  it('counts a Sunday as the last day of its week', () => {
    const sunday = new Date(2026, 8, 6, 12);
    const groups = groupByDeadline([due('next', new Date(2026, 8, 7, 9))], sunday);
    expect(groups.map((group) => group.key)).toEqual(['later']);
  });
});
