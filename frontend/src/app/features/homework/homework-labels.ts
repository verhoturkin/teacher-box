import { DatePipe } from '@angular/common';
import { AssignmentSummary, TaskStatus } from './data-access/homework.models';
import { T } from './i18n/texts';

export const TASK_STATUS_LABELS: Readonly<Record<TaskStatus, string>> = T.statuses;

export const TASK_STATUS_SEVERITIES: Readonly<
  Record<TaskStatus, 'warn' | 'danger' | 'success' | null>
> = {
  // null: the primary container, the default of p-tag (ADR-0023)
  ASSIGNED: null,
  SUBMITTED: 'warn',
  RETURNED: 'danger',
  ACCEPTED: 'success',
};

/** The badge of an assignment in the list: its progress as a whole. */
export interface AssignmentProgress {
  readonly label: string;
  readonly severity: 'secondary' | 'warn' | 'success' | null;
}

/**
 * Not given yet — neutral; works waiting for review — «На проверке: N»; all accepted — «Принято»; otherwise given
 * (with how many are accepted) — the main container.
 */
const DAY = 24 * 60 * 60 * 1000;

/** «сдано сегодня, 09:12», «сдано вчера, 22:40», «сдано 05.09 10:00»: when a work was handed in, from `now`. */
export function handedIn(submittedAt: string, now: number, dates: DatePipe): string {
  const at = new Date(submittedAt);
  const midnight = (moment: Date): number =>
    new Date(moment.getFullYear(), moment.getMonth(), moment.getDate()).getTime();
  const days = Math.round((midnight(new Date(now)) - midnight(at)) / DAY);
  const time = dates.transform(at, 'HH:mm') ?? '';
  return days === 0
    ? T.list.handedToday(time)
    : days === 1
      ? T.list.handedYesterday(time)
      : T.list.handedOn(dates.transform(at, 'dd.MM HH:mm') ?? '');
}

/** Every task of the assignment is accepted: the assignment is done («Принято»). */
export function isDone(assignment: Pick<AssignmentSummary, 'totalTasks' | 'accepted'>): boolean {
  return assignment.totalTasks > 0 && assignment.accepted === assignment.totalTasks;
}

export function assignmentProgress(assignment: AssignmentSummary): AssignmentProgress {
  const { totalTasks, submitted, accepted } = assignment;
  if (totalTasks === 0) {
    return { label: T.progress.notGiven, severity: 'secondary' };
  }
  if (submitted > 0) {
    return { label: T.progress.toReview(submitted), severity: 'warn' };
  }
  if (accepted === totalTasks) {
    return { label: T.progress.accepted, severity: 'success' };
  }
  return {
    label: accepted === 0 ? T.progress.given : T.progress.acceptedOf(accepted, totalTasks),
    severity: null,
  };
}

export { formatFileSize } from '@shared/files/file-size';

/** The icon of a file in a list: a picture, a PDF or any other file. */
export function fileIcon(contentType: string): string {
  return contentType.startsWith('image/')
    ? 'tb-i tb-i-image'
    : contentType === 'application/pdf'
      ? 'tb-i tb-i-picture_as_pdf'
      : 'tb-i tb-i-draft';
}
