import { AssignmentKind, TaskStatus } from './data-access/homework.models';
import { T } from './i18n/texts';

export const TASK_STATUS_LABELS: Readonly<Record<TaskStatus, string>> = T.statuses;

export const ASSIGNMENT_KIND_LABELS: Readonly<Record<AssignmentKind, string>> = T.kinds;

export const TASK_STATUS_SEVERITIES: Readonly<
  Record<TaskStatus, 'warn' | 'danger' | 'success' | null>
> = {
  // null: the primary container, the default of p-tag (ADR-0023)
  ASSIGNED: null,
  SUBMITTED: 'warn',
  RETURNED: 'danger',
  ACCEPTED: 'success',
};

export { formatFileSize } from '@shared/files/file-size';
