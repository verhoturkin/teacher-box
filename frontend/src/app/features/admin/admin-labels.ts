import { IntegrationState, LogLevelName } from './data-access/admin.models';

export type TagSeverity = 'success' | 'info' | 'warn' | 'danger' | 'secondary';

export const LEVELS: readonly LogLevelName[] = ['TRACE', 'DEBUG', 'INFO', 'WARN', 'ERROR'];

/** Tag colour of a log level. */
export function levelSeverity(level: string): TagSeverity {
  switch (level) {
    case 'ERROR':
      return 'danger';
    case 'WARN':
      return 'warn';
    case 'INFO':
      return 'info';
    default:
      return 'secondary';
  }
}

export const INTEGRATION_TAGS: Readonly<Record<IntegrationState, { label: string; severity: TagSeverity }>> = {
  OK: { label: 'Работает', severity: 'success' },
  FAILED: { label: 'Ошибка', severity: 'danger' },
  NOT_CONFIGURED: { label: 'Не подключено', severity: 'secondary' },
};

/** «ru.teacherbox.notifications.telegram.TelegramChannel» → «telegram.TelegramChannel». */
export function shortLogger(logger: string): string {
  const parts = logger.split('.');
  return parts.length <= 2 ? logger : parts.slice(-2).join('.');
}

/** «2 д 3 ч», «3 ч 12 мин», «45 мин». */
export function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  if (days > 0) {
    return `${String(days)} д ${String(hours)} ч`;
  }
  if (hours > 0) {
    return `${String(hours)} ч ${String(minutes)} мин`;
  }
  return `${String(minutes)} мин`;
}
