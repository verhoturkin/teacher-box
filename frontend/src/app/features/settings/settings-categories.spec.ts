import { aiStatus } from '@testing/ai-fixtures';
import { BackupInfo, MessengerStatus } from './data-access/settings.models';
import {
  aiState,
  categoryOfFolds,
  dataState,
  isCategory,
  mergedCategory,
  messengersState,
} from './settings-categories';

function messenger(
  channel: MessengerStatus['channel'],
  connection: MessengerStatus['connection'],
): MessengerStatus {
  return { channel, connection, error: null, checkedAt: null };
}

function backup(createdAt: string): BackupInfo {
  return { name: `${createdAt}.zip`, size: 1, createdAt, kind: 'SCHEDULED', version: '1.0.0' };
}

describe('settings categories', () => {
  it('knows seven categories; the merged ones lead to «Занятия»', () => {
    expect(isCategory('lessons')).toBe(true);
    expect(isCategory('students')).toBe(true);
    expect(isCategory('calendar')).toBe(false);
    expect(['calendar', 'calls', 'payments'].map(mergedCategory)).toEqual([
      'lessons',
      'lessons',
      'lessons',
    ]);
    expect(mergedCategory('portal')).toBeNull();
    expect(categoryOfFolds('meetings,data')).toBe('lessons');
  });

  it.each([
    [[messenger('TELEGRAM', 'OK'), messenger('VK', 'ERROR')], 'ВКонтакте не отвечает'],
    [[messenger('TELEGRAM', 'OK'), messenger('MAX', 'PENDING')], 'Telegram работает'],
    [[messenger('TELEGRAM', 'OK'), messenger('MAX', 'OK')], 'Telegram, MAX работают'],
    [[messenger('MAX', 'PENDING')], 'Проверяем связь с ботами'],
    [[], 'Боты не подключены'],
  ])('says how the bots are: %j → %s', (channels, state) => {
    expect(messengersState({ channels, failedDeliveries: [] })).toBe(state);
  });

  it.each([
    [aiStatus({ enabled: false }), 'Не подключён'],
    [aiStatus({ limitReached: true }), 'Лимит на месяц исчерпан'],
    [aiStatus({ monthlyTokenLimit: 0 }), 'Подключён'],
    [aiStatus({ usedThisMonth: 680, monthlyTokenLimit: 2_000 }), 'Подключён · 34 % лимита'],
  ])('says how the AI assistant is: %j → %s', (status, state) => {
    expect(aiState(status)).toBe(state);
  });

  describe('the newest backup', () => {
    const now = new Date(2026, 9, 2, 12, 0);

    it.each([
      [
        [
          backup(new Date(2026, 9, 1, 3, 0).toISOString()),
          backup(new Date(2026, 9, 2, 3, 0).toISOString()),
        ],
        'Копия сегодня в 03:00',
      ],
      [[backup(new Date(2026, 9, 1, 3, 30).toISOString())], 'Копия вчера в 03:30'],
      [[backup(new Date(2026, 8, 12, 3, 0).toISOString())], 'Копия 12 сентября'],
      [[], 'Копий пока нет'],
    ])('%j → %s', (backups, state) => {
      expect(dataState(backups, now)).toBe(state);
    });
  });
});
