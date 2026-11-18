import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { aBoard } from '@testing/boards-fixtures';
import { hostElement, readableText } from '@testing/dom';
import { at, groupLesson, scheduledLesson } from '@testing/schedule-fixtures';
import { testProviders } from '@testing/setup';
import type { ScheduledLesson } from '@features/schedule/parts';
import { TodayLessons } from './today-lessons';

describe('TodayLessons', () => {
  let fixture: ComponentFixture<TodayLessons>;
  let backend: HttpTestingController;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
    vi.setSystemTime(new Date(at(2026, 10, 1, 17, 20)));
    TestBed.configureTestingModule({ imports: [TodayLessons], providers: testProviders() });
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(TodayLessons);
  });

  afterEach(() => {
    backend.verify();
    fixture.destroy();
    vi.useRealTimers();
  });

  async function render(
    all: readonly ScheduledLesson[],
    next: ScheduledLesson | null,
  ): Promise<HTMLElement> {
    fixture.componentRef.setInput('all', all);
    fixture.componentRef.setInput('next', next);
    fixture.detectChanges();
    await fixture.whenStable();
    return hostElement(fixture);
  }

  function tick(hours: number, minutes: number): void {
    vi.setSystemTime(new Date(at(2026, 10, 1, hours, minutes)));
    vi.advanceTimersByTime(15_000);
    fixture.detectChanges();
  }

  const done = scheduledLesson({
    id: 'l-0',
    studentName: 'Маша Козлова',
    startsAt: at(2026, 10, 1, 10),
    endsAt: at(2026, 10, 1, 11),
    status: 'CONDUCTED',
  });
  const next = scheduledLesson({
    title: 'Степени',
    topic: 'Показатель и основание',
    joinUrl: 'https://telemost.yandex.ru/j/1',
  });

  it('expands the nearest lesson: state, end, who, the last board, the join button', async () => {
    const host = await render([next, done], next);
    backend.expectOne('/api/teacher/boards?studentId=s-1').flush([aBoard()]);
    fixture.detectChanges();
    await fixture.whenStable();
    const text = readableText(host);

    expect(host.querySelector('.p-card-title')?.textContent).toContain('Занятия сегодня');
    // sorted by the start; the other rows are one line with the outcome
    const rows = host.querySelectorAll('li');
    expect(rows[0]?.textContent).toContain('Маша Козлова');
    expect(rows[0]?.textContent).toContain('Проведено');
    expect(rows[1]?.classList.contains('tb-today-lesson--next')).toBe(true);
    expect(text).toContain('18:00 Через 40 мин до 19:00');
    expect(text).toContain('Иван Петров Степени Показатель и основание');
    expect(host.querySelector('a.tb-board-chip[href="/teacher/boards/board-1"]')).not.toBeNull();
    expect(text).toContain('Начать урок');
    expect(text).not.toContain('Следующее');
  });

  it('says «Идёт · ещё N мин» and «Войти в урок» while the lesson runs, reports its end', async () => {
    await render([next], next);
    backend.expectOne('/api/teacher/boards?studentId=s-1').flush([]);
    const ended = vi.fn();
    fixture.componentInstance.over.subscribe(ended);

    tick(18, 35);
    const host = hostElement(fixture);
    expect(readableText(host)).toContain('Идёт · ещё 25 мин');
    expect(host.querySelector('.tb-today-lesson__dot')).not.toBeNull();
    expect(readableText(host)).toContain('Войти в урок');
    expect(host.querySelector('tb-board-links a')).toBeNull();

    tick(19, 0);
    tick(19, 0);
    expect(ended).toHaveBeenCalledTimes(1);
  });

  it('offers «Позвать» while a lesson runs in the portal’s room and someone is not in it', async () => {
    const live = groupLesson({ joinUrl: 'https://school.example.org/call/g-1' });
    await render([live], live);
    backend.expectOne('/api/teacher/boards?groupId=g-1').flush([]);

    tick(18, 10);
    await fixture.whenStable();
    backend.expectOne('/api/teacher/meetings/calls').flush({
      status: 'OK',
      rooms: [
        {
          ownerId: 'g-1',
          ownerType: 'GROUP',
          name: 'ОГЭ',
          members: 2,
          waiting: [],
          teacherPresent: true,
          externalLink: false,
          avatar: null,
        },
      ],
    });
    fixture.detectChanges();

    expect(readableText(hostElement(fixture))).toContain(
      'Ещё не в звонке: 2 из 2 Позвать остальных',
    );
  });

  it('shows the duration beyond the hour and no join button without a call', async () => {
    const host = await render([groupLesson()], groupLesson());
    backend.expectOne('/api/teacher/boards?groupId=g-1').flush([]);
    tick(12, 0);

    expect(readableText(host)).toContain('90 мин');
    expect(host.querySelector('tb-join-lesson-button')).toBeNull();
  });

  it('with no lessons today is «Ближайшее занятие» with the day of the lesson', async () => {
    const tomorrow = scheduledLesson({
      startsAt: at(2026, 10, 2, 9),
      endsAt: at(2026, 10, 2, 10),
    });
    const host = await render([], tomorrow);
    backend.expectOne('/api/teacher/boards?studentId=s-1').flush([]);

    expect(host.querySelector('.p-card-title')?.textContent).toContain('Ближайшее занятие');
    expect(readableText(host)).toContain('09:00 Завтра до 10:00');
  });

  it('adds a nearest lesson of another day after today’s rows', async () => {
    const tomorrow = scheduledLesson({
      id: 'l-2',
      startsAt: at(2026, 10, 2, 9),
      endsAt: at(2026, 10, 2, 10),
    });
    const host = await render([done], tomorrow);
    backend.expectOne('/api/teacher/boards?studentId=s-1').flush([]);

    expect(host.querySelector('.p-card-title')?.textContent).toContain('Занятия сегодня');
    const rows = host.querySelectorAll('li');
    expect(rows).toHaveLength(2);
    expect(rows[1]?.classList.contains('tb-today-lesson--next')).toBe(true);
  });
});
