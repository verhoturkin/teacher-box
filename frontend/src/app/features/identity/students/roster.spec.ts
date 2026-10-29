import { aGroup, aStudent } from '@testing/identity-fixtures';
import { at, groupLesson, scheduledLesson } from '@testing/schedule-fixtures';
import { RosterData, RosterFilter, filterRows, isOff, lessonWhen, rosterRows } from './roster';

const NOW = new Date(2026, 9, 20, 12).getTime();
const WORDS = { today: 'сегодня', tomorrow: 'завтра' };

const MARIA = aStudent({ id: 'm', displayName: 'Мария' });
const BORIS = aStudent({ id: 'b', displayName: 'Борис', status: 'INVITED' });
const OLEG = aStudent({ id: 'o', displayName: 'Олег', status: 'DEACTIVATED' });
const OGE = aGroup({ id: 'g', name: 'ОГЭ' });
const SUMMER = aGroup({ id: 'old', name: 'Летняя школа', archivedAt: '2026-09-01T10:00:00Z' });

function data(overrides: Partial<RosterData> = {}): RosterData {
  return {
    students: [MARIA, OLEG, BORIS],
    groups: [SUMMER, OGE],
    balances: new Map([
      ['m', -300_000],
      ['o', -100_000],
      ['b', 150_000],
    ]),
    messengers: new Set(['m']),
    lessons: [],
    ...overrides,
  };
}

function names(filter: RosterFilter, query = ''): string[] {
  return filterRows(rosterRows(data(), NOW), filter, query).map((row) => row.name);
}

describe('roster', () => {
  it('lists the students by name, then the groups', () => {
    expect(rosterRows(data(), NOW).map((row) => row.name)).toEqual([
      'Борис',
      'Мария',
      'Олег',
      'Летняя школа',
      'ОГЭ',
    ]);
  });

  it('filters by the chips', () => {
    expect(names('all')).toEqual(['Борис', 'Мария', 'ОГЭ']);
    expect(names('groups')).toEqual(['ОГЭ']);
    expect(names('deactivated')).toEqual(['Олег', 'Летняя школа']);
  });

  it('filters by the name within a chip', () => {
    expect(names('all', '  МАР ')).toEqual(['Мария']);
    expect(names('deactivated', 'шк')).toEqual(['Летняя школа']);
    expect(names('groups', 'мар')).toEqual([]);
  });

  it('knows nothing of balances and messengers it could not read', () => {
    const rows = rosterRows(data({ balances: null, messengers: null, lessons: null }), NOW);
    const maria = rows.find((row) => row.id === 'm');
    expect(maria).toMatchObject({ balance: null, messenger: null, next: null });
  });

  it('takes a student without a balance as settled', () => {
    const rows = rosterRows(data({ balances: new Map() }), NOW);
    expect(rows.find((row) => row.id === 'm')).toMatchObject({ balance: 0 });
  });

  it('finds the nearest planned lesson of a student and of a group', () => {
    const lessons = [
      scheduledLesson({
        id: 'later',
        studentId: 'm',
        participants: [],
        startsAt: at(2026, 10, 23, 17),
        endsAt: at(2026, 10, 23, 18),
      }),
      scheduledLesson({
        id: 'over',
        studentId: 'm',
        participants: [],
        startsAt: at(2026, 10, 20, 9),
        endsAt: at(2026, 10, 20, 10),
      }),
      scheduledLesson({
        id: 'cancelled',
        studentId: 'm',
        participants: [],
        status: 'CANCELLED',
        startsAt: at(2026, 10, 20, 15),
        endsAt: at(2026, 10, 20, 16),
      }),
      groupLesson({
        groupId: 'g',
        participants: [
          { studentId: 'm', studentName: 'Мария', studentAvatar: null, attendance: 'EXPECTED' },
        ],
        startsAt: at(2026, 10, 21, 16),
        endsAt: at(2026, 10, 21, 17),
      }),
    ];
    const rows = rosterRows(data({ lessons }), NOW);

    expect(rows.find((row) => row.id === 'm')?.next).toBe(at(2026, 10, 21, 16));
    expect(rows.find((row) => row.id === 'g')?.next).toBe(at(2026, 10, 21, 16));
    expect(rows.find((row) => row.id === 'b')?.next).toBeNull();
  });

  it('tells a turned-off student and an archived group apart', () => {
    const rows = rosterRows(data(), NOW);
    expect(rows.filter(isOff).map((row) => row.name)).toEqual(['Олег', 'Летняя школа']);
  });

  it('says shortly when a lesson is', () => {
    expect(lessonWhen(at(2026, 10, 20, 16), NOW, WORDS)).toBe('сегодня 16:00');
    expect(lessonWhen(at(2026, 10, 21, 9, 30), NOW, WORDS)).toBe('завтра 09:30');
    expect(lessonWhen(at(2026, 10, 22, 17), NOW, WORDS)).toBe('чт 17:00');
    expect(lessonWhen(at(2026, 10, 30, 17), NOW, WORDS)).toBe('30.10 17:00');
  });
});
