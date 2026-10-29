import { HttpTestingController, TestRequest } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { buttonByText, hostElement, readableText } from '@testing/dom';
import { groupLesson, scheduledLesson } from '@testing/schedule-fixtures';
import { testProviders } from '@testing/setup';
import { toIsoDate } from '@shared/dates/iso-date';
import { LessonsOf } from '../data-access/schedule-api';
import {
  HistoryEntry,
  ScheduledLesson,
  UpcomingLessons,
  UpcomingSeries,
} from '../data-access/schedule.models';
import { formatLessonStart, formatLessonTime } from '../schedule-labels';
import { fromIsoDate } from '@shared/dates/iso-date';
import { StudentLessonsTab } from './student-lessons-tab';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

function inHours(hours: number): { startsAt: string; endsAt: string } {
  const start = Date.now() + hours * HOUR;
  return {
    startsAt: new Date(start).toISOString(),
    endsAt: new Date(start + HOUR).toISOString(),
  };
}

function daysFromToday(days: number): string {
  return toIsoDate(new Date(Date.now() + days * DAY));
}

function entry(overrides: Partial<HistoryEntry> = {}): HistoryEntry {
  return {
    lessonId: 'h-1',
    startsAt: inHours(-24).startsAt,
    title: null,
    topic: null,
    status: 'CONDUCTED',
    groupId: null,
    groupName: null,
    attendance: null,
    summary: null,
    nextPlan: null,
    summaryUpdatedAt: null,
    note: null,
    ...overrides,
  };
}

function series(overrides: Partial<UpcomingSeries> = {}): UpcomingSeries {
  return {
    ruleIds: ['r-1', 'r-2'],
    weekdays: ['TUESDAY', 'THURSDAY'],
    startTime: '15:00:00',
    durationMinutes: 60,
    intervalWeeks: 1,
    since: '2026-11-03',
    endsOn: '2026-12-25',
    remaining: 12,
    title: 'Английский',
    groupId: null,
    groupName: null,
    nextStartsAt: inHours(30).startsAt,
    ...overrides,
  };
}

const NONE: UpcomingLessons = { series: [], lessons: [] };

describe('StudentLessonsTab', () => {
  let fixture: ComponentFixture<StudentLessonsTab>;
  let backend: HttpTestingController;
  let of: LessonsOf;

  async function render(target: LessonsOf = { studentId: 's-1' }): Promise<void> {
    of = target;
    TestBed.configureTestingModule({ imports: [StudentLessonsTab], providers: testProviders() });
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(StudentLessonsTab);
    fixture.componentRef.setInput('of', target);
    await fixture.whenStable();
  }

  function lessonsRead(): TestRequest {
    return backend.expectOne((r) => r.url === '/api/teacher/schedule/lessons');
  }

  function upcomingRead(): TestRequest {
    return backend.expectOne(
      (r) =>
        r.url ===
        ('studentId' in of
          ? `/api/teacher/schedule/students/${of.studentId}/upcoming`
          : `/api/teacher/schedule/groups/${of.groupId}/upcoming`),
    );
  }

  function historyUrl(): string {
    return 'studentId' in of
      ? `/api/teacher/schedule/students/${of.studentId}/history`
      : `/api/teacher/schedule/groups/${of.groupId}/history`;
  }

  function historyRead(): TestRequest {
    return backend.expectOne((r) => r.url === historyUrl());
  }

  async function answer(
    lessons: ScheduledLesson[],
    history: HistoryEntry[] = [],
    grouped: UpcomingLessons = {
      series: [],
      lessons: lessons.map((lesson) => ({ kind: 'ONE_OFF' as const, lesson })),
    },
  ): Promise<void> {
    lessonsRead().flush(lessons);
    upcomingRead().flush(grouped);
    historyRead().flush(history);
    await fixture.whenStable();
  }

  /** The rows of a card, by its title. */
  function rows(title: string): string[] {
    const list = hostElement(fixture).querySelector(`ul[aria-label="${title}"]`);
    return Array.from(list?.querySelectorAll('li') ?? []).map((row) => readableText(row));
  }

  afterEach(() => {
    fixture.destroy();
    backend.verify();
  });

  it('reads the lessons ahead and the first page of the history of the student', async () => {
    await render();

    const request = lessonsRead();
    expect(request.request.params.get('studentId')).toBe('s-1');
    expect(request.request.params.get('from')).toBe(daysFromToday(0));
    expect(request.request.params.get('to')).toBe(daysFromToday(180));
    const page = historyRead();
    expect(page.request.params.get('limit')).toBe('20');
    expect(page.request.params.has('before')).toBe(false);
    request.flush([]);
    upcomingRead().flush(NONE);
    page.flush([]);
    await fixture.whenStable();

    const text = readableText(hostElement(fixture));
    expect(text).toContain('Занятий не запланировано');
    expect(text).toContain('Проведённых занятий пока нет');
    expect(hostElement(fixture).textContent).not.toContain('Показать ещё');
  });

  it('lists the lessons ahead, the nearest first, with the status', async () => {
    await render();
    const later = scheduledLesson({ id: 'later', ...inHours(48), title: 'Теорема Виета' });
    const cancelled = scheduledLesson({ id: 'cancelled', ...inHours(24), status: 'CANCELLED' });
    const past = scheduledLesson({ id: 'past', ...inHours(-3) });
    const recurring = groupLesson({ id: 'group', ...inHours(72), seriesId: 'series-1' });
    await answer([later, past, recurring, cancelled], [], { series: [series()], lessons: [] });

    buttonByText(hostElement(fixture), 'Показать все даты').click();
    await fixture.whenStable();

    expect(rows('Предстоящие')).toEqual([
      `${formatLessonTime(cancelled.startsAt, cancelled.endsAt)} Тема не задана Отменено`,
      `${formatLessonTime(later.startsAt, later.endsAt)} Теорема Виета`,
      `${formatLessonTime(recurring.startsAt, recurring.endsAt)} Группа «ОГЭ» · Тема не задана · регулярное`,
    ]);
    expect(hostElement(fixture).querySelector('li.tb-inactive')).not.toBeNull();

    buttonByText(hostElement(fixture), 'Свернуть даты').click();
    await fixture.whenStable();
    expect(rows('Предстоящие')).toHaveLength(1);
  });

  it('shows a series as one row and its exceptions and one-off lessons as their own', async () => {
    await render();
    const moved = scheduledLesson({
      id: 'moved',
      ...inHours(50),
      originalStartsAt: inHours(26).startsAt,
      title: 'Английский',
      seriesId: 'r-1',
    });
    const cancelled = scheduledLesson({
      id: 'off',
      ...inHours(74),
      status: 'CANCELLED',
      seriesId: 'r-2',
    });
    const changed = scheduledLesson({ id: 'changed', ...inHours(98), seriesId: 'r-1' });
    const single = scheduledLesson({ id: 'single', ...inHours(10), title: 'Пробное' });
    await answer([moved, cancelled, changed, single], [], {
      series: [
        series(),
        series({
          ruleIds: ['r-3'],
          weekdays: ['FRIDAY'],
          intervalWeeks: 2,
          endsOn: null,
          remaining: null,
          title: null,
          groupId: 'g-1',
          groupName: 'ОГЭ',
          nextStartsAt: inHours(120).startsAt,
        }),
      ],
      lessons: [
        { kind: 'MOVED', lesson: moved },
        { kind: 'CANCELLED', lesson: cancelled },
        { kind: 'CHANGED', lesson: changed },
        { kind: 'ONE_OFF', lesson: single },
      ],
    });

    const day = (iso: string): string =>
      fromIsoDate(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
    expect(rows('Предстоящие')).toEqual([
      `${formatLessonTime(single.startsAt, single.endsAt)} Пробное`,
      `Каждый вт и чт, 15:00 · 60 мин Английский · с ${day('2026-11-03')} · до ${day('2026-12-25')} · ещё 12`,
      `${formatLessonStart(moved.originalStartsAt ?? '')} Перенесено на ${formatLessonStart(moved.startsAt)} · Английский`,
      `${formatLessonTime(cancelled.startsAt, cancelled.endsAt)} Тема не задана Отменено`,
      `${formatLessonTime(changed.startsAt, changed.endsAt)} изменено отдельно · Тема не задана`,
      `Раз в 2 недели: пт, 15:00 · 60 мин Группа «ОГЭ» · с ${day('2026-11-03')}`,
    ]);
    expect(hostElement(fixture).querySelectorAll('.tb-list__lead--accent')).toHaveLength(1);
  });

  it('shows the history with the summary, the plan and the own note', async () => {
    await render();
    const full = entry({
      lessonId: 'full',
      title: 'Дроби',
      summary: 'Сложили **дроби**',
      nextPlan: 'Разобрать степени',
      note: 'Быстро устаёт',
      attendance: 'ATTENDED',
    });
    const group = entry({
      lessonId: 'group',
      startsAt: inHours(-48).startsAt,
      groupId: 'g-1',
      groupName: 'ОГЭ',
      attendance: 'MISSED',
    });
    const missed = entry({
      lessonId: 'missed',
      startsAt: inHours(-72).startsAt,
      status: 'MISSED',
      attendance: 'EXPECTED',
    });
    await answer([], [full, group, missed]);

    expect(rows('История')).toEqual([
      `${formatLessonStart(full.startsAt)} Дроби Что прошли Сложили дроби Что дальше Разобрать степени Заметка для себя Быстро устаёт Проведено`,
      `${formatLessonStart(group.startsAt)} Группа «ОГЭ» · Тема не задана Пропуск`,
      `${formatLessonStart(missed.startsAt)} Тема не задана Пропуск`,
    ]);
    expect(hostElement(fixture).querySelector('li strong')?.textContent).toBe('дроби');
  });

  it('reads the next page on «Показать ещё» while a full page comes back', async () => {
    await render();
    const first = Array.from({ length: 20 }, (_, i) =>
      entry({ lessonId: `e-${String(i)}`, startsAt: inHours(-24 - i).startsAt }),
    );
    await answer([], first);
    expect(rows('История')).toHaveLength(20);

    buttonByText(hostElement(fixture), 'Показать ещё').click();
    const second = historyRead();
    expect(second.request.params.get('before')).toBe(first[19]?.startsAt);
    second.flush([entry({ lessonId: 'old', startsAt: inHours(-900).startsAt })]);
    await fixture.whenStable();

    expect(rows('История')).toHaveLength(21);
    expect(hostElement(fixture).textContent).not.toContain('Показать ещё');
  });

  it('keeps the feed when the next page fails', async () => {
    await render();
    const first = Array.from({ length: 20 }, (_, i) =>
      entry({ lessonId: `e-${String(i)}`, startsAt: inHours(-24 - i).startsAt }),
    );
    await answer([], first);

    buttonByText(hostElement(fixture), 'Показать ещё').click();
    historyRead().flush({}, { status: 500, statusText: 'Server Error' });
    await fixture.whenStable();

    expect(rows('История')).toHaveLength(20);
    expect(buttonByText(hostElement(fixture), 'Показать ещё')).toBeTruthy();
  });

  it('reads the lessons and the history of a group without naming the group in every row', async () => {
    await render({ groupId: 'g-1' });
    const lesson = groupLesson({ id: 'g', ...inHours(5) });
    const request = lessonsRead();
    expect(request.request.params.get('groupId')).toBe('g-1');
    request.flush([lesson]);
    upcomingRead().flush({ series: [], lessons: [{ kind: 'ONE_OFF', lesson }] });
    historyRead().flush([
      entry({ groupId: 'g-1', groupName: 'ОГЭ', title: 'Итоги', summary: 'Повторили' }),
    ]);
    await fixture.whenStable();

    expect(rows('Предстоящие')).toEqual([
      `${formatLessonTime(lesson.startsAt, lesson.endsAt)} Тема не задана`,
    ]);
    expect(rows('История')[0]).toContain(' Итоги Что прошли Повторили Проведено');
    expect(rows('История')[0]).not.toContain('Группа');
  });

  it('reads again when the card planned a lesson', async () => {
    await render();
    await answer([]);

    fixture.componentRef.setInput('revision', 1);
    await fixture.whenStable();

    await answer([]);
  });
});
