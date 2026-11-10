import { dueSoonExample, horizonExample, lateExample, remindersExample } from './setup-examples';

describe('setup examples', () => {
  it('shows a late cancellation for the window, a short one halved', () => {
    expect(lateExample(1440)).toBe(
      'Урок в четверг в 10:00. Ученик отменил в среду в 20:00 — это поздняя отмена: вы решаете, списать ли занятие.',
    );
    expect(lateExample(120)).toContain('отменил в четверг в 9:00');
    expect(lateExample(15)).toContain('отменил в четверг в 9:52');
    expect(lateExample(0)).toContain('Поздних отмен не будет');
  });

  it('lists the reminders longest first and the teacher only gets the last one', () => {
    expect(remindersExample([60, 1440])).toBe(
      'Ученик получит сообщение в среду в 10:00 и в четверг в 9:00. Вам — только в 9:00.',
    );
    expect(remindersExample([2880, 1440, 60])).toContain(
      'во вторник в 10:00, в среду в 10:00 и в четверг в 9:00',
    );
    expect(remindersExample([30])).toBe('Сообщение придёт ученику и вам в четверг в 9:30.');
    expect(remindersExample([])).toContain('никто не получит');
  });

  it('shows the deadline reminder and the series', () => {
    expect(dueSoonExample(1440)).toBe(
      'Срок — пятница, 18:00. Если работа не сдана, ученику напомнят в четверг в 18:00.',
    );
    expect(horizonExample(12)).toContain('на 12\u00A0недель вперёд');
    expect(horizonExample(21)).toContain('на 21\u00A0неделю вперёд');
  });
});
