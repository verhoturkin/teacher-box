import { dueAtOf, effectiveDue } from './due-chips';

describe('due chips', () => {
  const lesson = new Date('2026-11-05T15:00:00Z');
  const picked = new Date('2026-11-09T10:00:00Z');

  it('drops the lesson choice when there is no lesson ahead', () => {
    expect(effectiveDue('lesson', null)).toBe('none');
    expect(effectiveDue('lesson', lesson)).toBe('lesson');
    expect(effectiveDue('date', null)).toBe('date');
  });

  it('turns a choice into the due date', () => {
    expect(dueAtOf('lesson', lesson, picked)).toBe(lesson);
    expect(dueAtOf('lesson', null, picked)).toBeNull();
    expect(dueAtOf('date', lesson, picked)).toBe(picked);
    expect(dueAtOf('none', lesson, picked)).toBeNull();
    const week = dueAtOf('week', null, null)?.getTime() ?? 0;
    expect(week - Date.now()).toBeGreaterThan(6.9 * 24 * 60 * 60 * 1000);
  });
});
