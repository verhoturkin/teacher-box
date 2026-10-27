import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { bodyText, buttonByText, hostElement, readableText, requireElement } from '@testing/dom';
import { aGroup } from '@testing/identity-fixtures';
import {
  changeRequest,
  groupLesson,
  scheduleSettings,
  scheduledLesson,
} from '@testing/schedule-fixtures';
import { phoneScreen, testProviders } from '@testing/setup';
import { ScheduledLesson } from '../data-access/schedule.models';
import { ScheduleAgenda, weekDays, weekStart } from '../ui/schedule-agenda';
import { ScheduleCalendar } from '../ui/schedule-calendar';
import { SchedulePage } from './schedule-page';

/** Today at the hour, as the ISO instant of the lessons. */
function today(hours: number): string {
  const date = new Date();
  date.setHours(hours, 0, 0, 0);
  return date.toISOString();
}

// From midnight: the lesson has always begun (its card offers «Итог»), whatever the hour and the time
// zone of the run — CI starts before 08:00 local time
function lessonToday(overrides: Partial<ScheduledLesson> = {}): ScheduledLesson {
  return scheduledLesson({ startsAt: today(0), endsAt: today(1), ...overrides });
}

describe('SchedulePage on a phone', () => {
  let fixture: ComponentFixture<SchedulePage>;
  let backend: HttpTestingController;
  let lessons: ScheduledLesson[];
  let unmarked: ScheduledLesson[];

  beforeEach(() => {
    lessons = [lessonToday()];
    unmarked = [];
    TestBed.configureTestingModule({
      imports: [SchedulePage],
      providers: testProviders(phoneScreen()),
    });
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(SchedulePage);
  });

  afterEach(() => {
    // Boards of the lesson in its card (covered by the card's own tests)
    for (const request of backend.match((request) => request.url === '/api/teacher/boards')) {
      request.flush([]);
    }
    backend.verify();
    fixture.destroy();
  });

  /** Answers every request that waits; the lessons and the unmarked ones are the test's. */
  async function settle(): Promise<void> {
    for (let round = 0; round < 3; round++) {
      await fixture.whenStable();
      for (const request of backend.match(() => true)) {
        const url = request.request.url;
        if (url === '/api/me/schedule/settings') {
          request.flush(scheduleSettings());
        } else if (url === '/api/teacher/groups') {
          request.flush([aGroup({ id: 'g-1', name: 'ОГЭ' })]);
        } else if (url === '/api/teacher/students') {
          request.flush([{ id: 's-1', displayName: 'Иван Петров', status: 'ACTIVE' }]);
        } else if (url === '/api/teacher/schedule/requests') {
          request.flush([changeRequest({ late: true })]);
        } else if (url === '/api/teacher/schedule/unmarked') {
          request.flush(unmarked);
        } else if (url === '/api/teacher/schedule/google') {
          request.flush({ status: 'NOT_CONNECTED', busyEnabled: false });
        } else if (url === '/api/teacher/schedule/lessons') {
          request.flush(lessons);
        } else if (url.endsWith('/outcome')) {
          request.flush(scheduledLesson({ status: 'MISSED' }));
        } else if (url === '/api/teacher/boards') {
          request.flush([]);
        } else {
          request.flush([]);
        }
      }
    }
    await fixture.whenStable();
  }

  async function render(): Promise<HTMLElement> {
    fixture.detectChanges();
    await settle();
    return hostElement(fixture);
  }

  async function pickScreen(item: string): Promise<void> {
    buttonByText(hostElement(fixture), item).click();
    await settle();
  }

  it('shows the week strip and the lessons of the day, and plans a lesson with the FAB', async () => {
    const host = await render();

    expect(host.querySelectorAll('.tb-agenda__day')).toHaveLength(7);
    expect(host.querySelector('.tb-agenda__day[aria-pressed="true"]')).not.toBeNull();
    expect(host.querySelectorAll('.tb-agenda__dot--on')).toHaveLength(1);
    expect(readableText(host)).toContain('Иван Петров');
    expect(host.querySelector('.tb-calendar-title')).toBeNull();
    // the top bar: the screens and the main action, the same button as the FAB (ADR-0018)
    expect(host.querySelectorAll('.tb-page-header .tb-actions button')).toHaveLength(1);

    requireElement(host, '.tb-page-fab button', HTMLButtonElement).click();
    await fixture.whenStable();
    expect(bodyText()).toContain('Новое занятие');
  });

  it('moves between days and weeks and opens a lesson of the day', async () => {
    const host = await render();
    const agenda = fixture.debugElement
      .query(By.directive(ScheduleAgenda))
      .injector.get(ScheduleAgenda);
    const before = weekStart(new Date().toISOString().slice(0, 10));

    buttonByText(host, 'Следующая неделя').click();
    await settle();
    expect(readableText(host)).toContain('В этот день занятий нет');
    expect(weekStart(agenda.day())).not.toBe(before);

    buttonByText(host, 'Предыдущая неделя').click();
    await settle();
    expect(readableText(host)).toContain('Иван Петров');

    requireElement(host, '.tb-agenda__row', HTMLButtonElement).click();
    await fixture.whenStable();
    expect(bodyText()).toContain('Итог');
  });

  it('marks a past lesson from the group under its row', async () => {
    unmarked = [lessonToday({ id: 'l-9' })];
    lessons = unmarked;
    const host = await render();

    expect(readableText(host)).not.toContain('Отметьте прошедшие занятия');
    buttonByText(host, 'Проведено: Иван Петров');
    buttonByText(host, 'Пропуск: Иван Петров').click();
    unmarked = [];
    await fixture.whenStable();
    await settle();
    expect(host.querySelector('.tb-agenda__marks')).toBeNull();
  });

  it('marks the attendance of a group lesson', async () => {
    unmarked = [groupLesson({ startsAt: today(0), endsAt: today(1) })];
    lessons = unmarked;
    const host = await render();

    buttonByText(host, 'Отметить посещаемость: Группа «ОГЭ»').click();
    await fixture.whenStable();
    expect(bodyText()).toContain('Кто был на занятии');
  });

  it('goes to the day with lessons to mark when the chosen day has none', async () => {
    const week = weekDays(weekStart(new Date().toISOString().slice(0, 10)));
    const other = new Date(`${week[0] ?? ''}T10:00:00`);
    if (week[0] === new Date().toISOString().slice(0, 10)) {
      other.setDate(other.getDate() + 1);
    }
    unmarked = [
      scheduledLesson({
        id: 'l-5',
        startsAt: other.toISOString(),
        endsAt: new Date(other.getTime() + 3_600_000).toISOString(),
      }),
    ];
    lessons = unmarked;
    const host = await render();

    buttonByText(host, 'Не отмечено занятий: 1').click();
    await settle();
    expect(buttonByText(host, 'Проведено: Иван Петров')).not.toBeNull();
    expect(host.querySelector('.tb-agenda__jump')).toBeNull();
  });

  it('switches calendar instance between week and month using chips', async () => {
    const host = await render();

    await pickScreen('Неделя');
    expect(fixture.debugElement.query(By.directive(ScheduleAgenda))).toBeNull();
    const week = fixture.debugElement
      .query(By.directive(ScheduleCalendar))
      .injector.get(ScheduleCalendar);
    expect(week.phoneView()).toBe('timeGridWeek');
    expect(host.querySelector('.tb-page-title')?.textContent.trim()).toBe('Неделя');

    await pickScreen('Месяц');
    expect(
      fixture.debugElement
        .query(By.directive(ScheduleCalendar))
        .injector.get(ScheduleCalendar)
        .phoneView(),
    ).toBe('dayGridMonth');
    expect(
      fixture.debugElement.query(By.directive(ScheduleCalendar)).injector.get(ScheduleCalendar),
    ).not.toBe(week);

    await pickScreen('Повестка');
    expect(fixture.debugElement.query(By.directive(ScheduleAgenda))).not.toBeNull();
    expect(host.querySelector('.tb-page-title')?.textContent.trim()).toBe('Расписание');
  });

  it('opens time off as a screen without standalone recurring lessons', async () => {
    const host = await render();
    expect(readableText(host)).toContain('Запросы учеников');

    await pickScreen('Нерабочее время');
    expect(readableText(host)).toContain('Нерабочее время не отмечено');
    expect(host.querySelector('.tb-page-title')?.textContent.trim()).toBe('Нерабочее время');
  });
});
