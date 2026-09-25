import { TaskStatus } from './data-access/homework.models';

export const TASK_STATUS_LABELS: Readonly<Record<TaskStatus, string>> = {
  ASSIGNED: 'Выдано',
  SUBMITTED: 'На проверке',
  RETURNED: 'На доработке',
  ACCEPTED: 'Принято',
};

export const TASK_STATUS_SEVERITIES: Readonly<Record<TaskStatus, 'info' | 'warn' | 'danger' | 'success'>> = {
  ASSIGNED: 'info',
  SUBMITTED: 'warn',
  RETURNED: 'danger',
  ACCEPTED: 'success',
};

export { formatFileSize } from '@shared/files/file-size';
