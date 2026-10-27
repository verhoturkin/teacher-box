import { locale } from '@core/i18n/language';
import type { ScheduledLesson } from '@features/schedule/parts';
import { Student, StudentGroup } from '../data-access/identity.models';

/** The chips over the list of students and groups (redesign spec §8). */
export type RosterFilter = 'all' | 'groups' | 'debtors' | 'noMessenger' | 'deactivated';

export const ROSTER_FILTERS: readonly RosterFilter[] = [
  'all',
  'groups',
  'debtors',
  'noMessenger',
  'deactivated',
];

/** A student in the list with what the other features know of them; `null` — not known (not loaded). */
export interface StudentRow {
  readonly kind: 'student';
  readonly id: string;
  readonly name: string;
  readonly student: Student;
  /** Paid minus charged, minor units: negative is debt. */
  readonly balance: number | null;
  /** The student connected a messenger. */
  readonly messenger: boolean | null;
  /** The start of the nearest planned lesson (with the student alone or in a group). */
  readonly next: string | null;
}

/** A group in the same list. */
export interface GroupRow {
  readonly kind: 'group';
  readonly id: string;
  readonly name: string;
  readonly group: StudentGroup;
  /** The start of the nearest planned lesson of the group. */
  readonly next: string | null;
}

export type RosterRow = StudentRow | GroupRow;

/** What the list is made of: its own students and groups and the reads of other features (`null` — failed). */
export interface RosterData {
  readonly students: readonly Student[];
  readonly groups: readonly StudentGroup[];
  /** Balances by student (billing overview). */
  readonly balances: ReadonlyMap<string, number> | null;
  /** Current students with a connected messenger (notifications); the others have none. */
  readonly messengers: ReadonlySet<string> | null;
  /** Lessons of the next weeks (schedule). */
  readonly lessons: readonly ScheduledLesson[] | null;
}

function nextLesson(
  lessons: readonly ScheduledLesson[] | null,
  takes: (lesson: ScheduledLesson) => boolean,
  now: number,
): string | null {
  if (lessons === null) {
    return null;
  }
  let next: string | null = null;
  for (const lesson of lessons) {
    if (
      lesson.status === 'SCHEDULED' &&
      new Date(lesson.endsAt).getTime() > now &&
      takes(lesson) &&
      (next === null || lesson.startsAt < next)
    ) {
      next = lesson.startsAt;
    }
  }
  return next;
}

/** Students by name, then groups by name: one list (redesign spec §8). */
export function rosterRows(data: RosterData, now: number): RosterRow[] {
  const students = [...data.students]
    .sort((a, b) => a.displayName.localeCompare(b.displayName, 'ru'))
    .map((student): StudentRow => ({
      kind: 'student',
      id: student.id,
      name: student.displayName,
      student,
      balance: data.balances === null ? null : (data.balances.get(student.id) ?? 0),
      messenger: data.messengers === null ? null : data.messengers.has(student.id),
      next: nextLesson(
        data.lessons,
        (lesson) =>
          lesson.studentId === student.id ||
          lesson.participants.some((participant) => participant.studentId === student.id),
        now,
      ),
    }));
  const groups = [...data.groups]
    .sort((a, b) => a.name.localeCompare(b.name, 'ru'))
    .map((group): GroupRow => ({
      kind: 'group',
      id: group.id,
      name: group.name,
      group,
      next: nextLesson(data.lessons, (lesson) => lesson.groupId === group.id, now),
    }));
  return [...students, ...groups];
}

/** The student lost access or the group is in the archive: only «Отключённые» shows it. */
export function isOff(row: RosterRow): boolean {
  return row.kind === 'student'
    ? row.student.status === 'DEACTIVATED'
    : row.group.archivedAt !== null;
}

/** Whether the row is found by the chip. */
export function matchesFilter(row: RosterRow, filter: RosterFilter): boolean {
  switch (filter) {
    case 'all':
      return !isOff(row);
    case 'groups':
      return row.kind === 'group' && !isOff(row);
    case 'debtors':
      return row.kind === 'student' && (row.balance ?? 0) < 0;
    case 'noMessenger':
      return row.kind === 'student' && !isOff(row) && row.messenger === false;
    case 'deactivated':
      return isOff(row);
  }
}

/** The rows of the chip whose name has the query. */
export function filterRows(
  rows: readonly RosterRow[],
  filter: RosterFilter,
  query: string,
): RosterRow[] {
  const text = query.trim().toLocaleLowerCase('ru');
  return rows.filter(
    (row) => matchesFilter(row, filter) && row.name.toLocaleLowerCase('ru').includes(text),
  );
}

/** How many rows the chip finds. */
export function countRows(rows: readonly RosterRow[], filter: RosterFilter): number {
  return rows.filter((row) => matchesFilter(row, filter)).length;
}

const DAY_MS = 86_400_000;

function midnight(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/** The words of {@link lessonWhen}. */
export interface WhenWords {
  readonly today: string;
  readonly tomorrow: string;
}

/**
 * When a lesson is, short for a row: «сегодня 16:00», «завтра 16:00», within a week «вт 17:00», later
 * «23.10 17:00» (the browser's time zone).
 */
export function lessonWhen(startsAt: string, now: number, words: WhenWords): string {
  const start = new Date(startsAt);
  const time = new Intl.DateTimeFormat(locale(), { hour: '2-digit', minute: '2-digit' }).format(
    start,
  );
  // rounded: a day with a DST change is 23 or 25 hours long
  const days = Math.round((midnight(start) - midnight(new Date(now))) / DAY_MS);
  if (days <= 0) {
    return `${words.today} ${time}`;
  }
  if (days === 1) {
    return `${words.tomorrow} ${time}`;
  }
  const day =
    days < 7
      ? new Intl.DateTimeFormat(locale(), { weekday: 'short' }).format(start)
      : new Intl.DateTimeFormat(locale(), { day: '2-digit', month: '2-digit' }).format(start);
  return `${day} ${time}`;
}
