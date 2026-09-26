import { formatUptime, levelSeverity, shortLogger } from './admin-labels';

describe('admin labels', () => {
  it('colours log levels', () => {
    expect(levelSeverity('ERROR')).toBe('danger');
    expect(levelSeverity('WARN')).toBe('warn');
    expect(levelSeverity('INFO')).toBe('info');
    expect(levelSeverity('DEBUG')).toBe('secondary');
  });

  it('shortens logger names', () => {
    expect(shortLogger('ru.teacherbox.notifications.telegram.TelegramChannel')).toBe('telegram.TelegramChannel');
    expect(shortLogger('teacherbox.audit')).toBe('teacherbox.audit');
  });

  it('formats uptime', () => {
    expect(formatUptime(2 * 86_400 + 3 * 3_600 + 60)).toBe('2 д 3 ч');
    expect(formatUptime(3 * 3_600 + 12 * 60)).toBe('3 ч 12 мин');
    expect(formatUptime(45 * 60 + 30)).toBe('45 мин');
  });
});
