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

/** «2,5 МБ» for a size in bytes. */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${String(bytes)} Б`;
  }
  const units = ['КБ', 'МБ', 'ГБ'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value.toLocaleString('ru-RU', { maximumFractionDigits: 1 })} ${units[unit] ?? ''}`;
}
