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
    ? 'pi pi-image'
    : contentType === 'application/pdf'
      ? 'pi pi-file-pdf'
      : 'pi pi-file';
}
