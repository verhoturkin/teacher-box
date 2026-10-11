import { IntegrationState, LogLevelName } from './data-access/admin.models';
import { T } from './i18n/texts';

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

export const INTEGRATION_TAGS: Readonly<
  Record<IntegrationState, { label: string; severity: TagSeverity }>
> = {
  OK: { label: T.integrationStates.OK, severity: 'success' },
  FAILED: { label: T.integrationStates.FAILED, severity: 'danger' },
  NOT_CONFIGURED: { label: T.integrationStates.NOT_CONFIGURED, severity: 'secondary' },
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
    return T.uptime.days(days, hours);
  }
  if (hours > 0) {
    return T.uptime.hours(hours, minutes);
  }
  return T.uptime.minutes(minutes);
}
