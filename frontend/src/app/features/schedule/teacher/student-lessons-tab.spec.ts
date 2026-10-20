import { HttpTestingController, TestRequest } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { buttonByText, hostElement, readableText } from '@testing/dom';
import { groupLesson, scheduledLesson } from '@testing/schedule-fixtures';
import { testProviders } from '@testing/setup';
import { toIsoDate } from '@shared/dates/iso-date';
import { LessonsOf } from '../data-access/schedule-api';
import { ScheduledLesson } from '../data-access/schedule.models';
import { formatLessonTime } from '../schedule-labels';
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

describe('StudentLessonsTab', () => {
  let fixture: ComponentFixture<StudentLessonsTab>;
  let backend: HttpTestingController;

  async function render(of: LessonsOf = { studentId: 's-1' }): Promise<void> {
    TestBed.configureTestingModule({ imports: [StudentLessonsTab], providers: testProviders() });
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(StudentLessonsTab);
    fixture.componentRef.setInput('of', of);
    await fixture.whenStable();
  }

  function lessonsRead(): TestRequest {
    return backend.expectOne((r) => r.url === '/api/teacher/schedule/lessons');
  }

  async function answer(lessons: ScheduledLesson[]): Promise<void> {
    lessonsRead().flush(lessons);
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

  it('reads half a year back and ahead of the student', async () => {
    await render();

    const request = lessonsRead();
    expect(request.request.params.get('studentId')).toBe('s-1');
    expect(request.request.params.get('from')).toBe(daysFromToday(-180));
    expect(request.request.params.get('to')).toBe(daysFromToday(180));
    request.flush([]);
    await fixture.whenStable();

    const text = readableText(hostElement(fixture));
    expect(text).toContain('Занятий не запланировано');
    expect(text).toContain('Прошедших занятий нет');
  });

  it('lists the lessons ahead, the nearest first, and the past ones, the latest first, with the outcome', async () => {
    await render();
    const later = scheduledLesson({ id: 'later', ...inHours(48), topic: 'Теорема Виета' });
    const cancelled = scheduledLesson({ id: 'cancelled', ...inHours(24), status: 'CANCELLED' });
    const conducted = scheduledLesson({ id: 'conducted', ...inHours(-30), status: 'CONDUCTED' });
    const unmarked = scheduledLesson({ id: 'unmarked', ...inHours(-3), seriesId: 'series-1' });
    const missed = groupLesson({
      id: 'missed',
      ...inHours(-50),
      status: 'CONDUCTED',
      participants: [
        { studentId: 's-1', studentName: 'Иван', studentAvatar: null, attendance: 'MISSED' },
      ],
    });
    await answer([conducted, later, missed, cancelled, unmarked]);

    expect(rows('Предстоящие')).toEqual([
      `${formatLessonTime(cancelled.startsAt, cancelled.endsAt)} Тема не задана Отменено`,
      `${formatLessonTime(later.startsAt, later.endsAt)} Теорема Виета`,
    ]);
    expect(rows('Прошедшие')).toEqual([
      `${formatLessonTime(unmarked.startsAt, unmarked.endsAt)} Тема не задана · регулярное Запланировано`,
      `${formatLessonTime(conducted.startsAt, conducted.endsAt)} Тема не задана Проведено`,
      `${formatLessonTime(missed.startsAt, missed.endsAt)} Группа «ОГЭ» · Тема не задана Пропуск`,
    ]);
    expect(hostElement(fixture).querySelector('li.tb-inactive')).not.toBeNull();
  });

  it('reads the year before on «Показать ранее» and keeps what is shown', async () => {
    await render();
    const recent = scheduledLesson({ id: 'recent', ...inHours(-24), status: 'CONDUCTED' });
    await answer([recent]);

    buttonByText(hostElement(fixture), 'Показать ранее').click();
    const earlier = lessonsRead();
    expect(earlier.request.params.get('from')).toBe(daysFromToday(-180 - 360));
    expect(earlier.request.params.get('to')).toBe(daysFromToday(-181));
    const old = scheduledLesson({ id: 'old', ...inHours(-200 * 24), status: 'CONDUCTED' });
    earlier.flush([old, recent]);
    await fixture.whenStable();

    expect(rows('Прошедшие')).toHaveLength(2);

    buttonByText(hostElement(fixture), 'Показать ранее').click();
    lessonsRead().flush({}, { status: 500, statusText: 'Server Error' });
    await fixture.whenStable();
    expect(rows('Прошедшие')).toHaveLength(2);
  });

  it('reads the lessons of a group without naming the group in every row', async () => {
    await render({ groupId: 'g-1' });
    const lesson = groupLesson({ id: 'g', ...inHours(5) });
    const request = lessonsRead();
    expect(request.request.params.get('groupId')).toBe('g-1');
    request.flush([lesson]);
    await fixture.whenStable();

    expect(rows('Предстоящие')).toEqual([
      `${formatLessonTime(lesson.startsAt, lesson.endsAt)} Тема не задана`,
    ]);
  });

  it('reads again when the card planned a lesson', async () => {
    await render();
    await answer([]);

    fixture.componentRef.setInput('revision', 1);
    await fixture.whenStable();

    await answer([]);
  });
});
