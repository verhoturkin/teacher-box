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

  it('splits into the hero (only the expanded lesson, no title) and the rest beside it', async () => {
    fixture.componentRef.setInput('part', 'hero');
    let host = await render([next, done], next);
    backend.expectOne('/api/teacher/boards?studentId=s-1').flush([]);

    expect(host.querySelectorAll('li')).toHaveLength(1);
    expect(host.querySelector('li.tb-today-lesson--next')).not.toBeNull();
    expect(host.querySelector('.p-card-title')).toBeNull();

    fixture.componentRef.setInput('part', 'rest');
    host = await render([next, done], next);
    expect(host.querySelectorAll('li')).toHaveLength(1);
    expect(host.querySelector('li')?.textContent).toContain('Маша Козлова');
    expect(host.querySelector('.tb-today-lesson--next')).toBeNull();

    // only the expanded lesson today: nothing is left beside the hero
    host = await render([next], next);
    expect(host.querySelector('p-card')).toBeNull();
  });

  it('as the hero is one line: the time tile, who, the join button; the wavy bar while live', async () => {
    fixture.componentRef.setInput('part', 'hero');
    const host = await render([next], next);
    backend.expectOne('/api/teacher/boards?studentId=s-1').flush([]);

    expect(host.querySelector('.tb-today-hero tb-lesson-time-tile')?.textContent).toContain(
      '18:00',
    );
    expect(host.querySelector('.tb-today-hero__name')?.textContent).toContain('Иван Петров');
    expect(readableText(host)).toContain('Степени · Показатель и основание');
    expect(host.querySelector('.tb-today-hero__join .p-button.tb-button-m')).not.toBeNull();
    expect(readableText(host)).toContain('Начать урок');
    expect(host.querySelector('tb-wavy-progress')).toBeNull();

    tick(18, 35);
    const bar = host.querySelector('tb-wavy-progress');
    expect(bar?.getAttribute('aria-valuenow')).toBe('58');
    expect(bar?.getAttribute('aria-label')).toBe('Прошло 35 из 60 мин');
    expect(readableText(host)).toContain('Войти в урок');
  });

  it('as the hero puts «Позвать» into one group with the join button', async () => {
    fixture.componentRef.setInput('part', 'hero');
    const live = scheduledLesson({ joinUrl: 'https://school.example.org/call/s-1' });
    const host = await render([live], live);
    backend.expectOne('/api/teacher/boards?studentId=s-1').flush([]);

    tick(18, 10);
    await fixture.whenStable();
    backend.expectOne('/api/teacher/meetings/calls').flush({
      status: 'OK',
      rooms: [
        {
          ownerId: 's-1',
          ownerType: 'STUDENT',
          name: 'Иван Петров',
          members: 1,
          waiting: [],
          teacherPresent: false,
          externalLink: false,
          avatar: null,
        },
      ],
    });
    fixture.detectChanges();

    const group = host.querySelector<HTMLElement>('tb-call-summon .tb-button-group');
    expect(group?.querySelector('tb-join-lesson-button')).not.toBeNull();
    // the primary action last, at the trailing edge (M3); the presence by the board, before the buttons
    expect(group?.textContent).toMatch(/Позвать\s*Войти в урок/);
    expect(readableText(host)).toMatch(/Иван ещё не в звонке\s*Позвать/);
  });

  it('beside the hero does not report the end a second time', async () => {
    fixture.componentRef.setInput('part', 'rest');
    await render([next, done], next);
    const ended = vi.fn();
    fixture.componentInstance.over.subscribe(ended);

    tick(19, 0);
    expect(ended).not.toHaveBeenCalled();
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
