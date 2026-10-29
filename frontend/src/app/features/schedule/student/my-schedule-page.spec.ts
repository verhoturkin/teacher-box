import { BreakpointObserver, BreakpointState } from '@angular/cdk/layout';
import { HttpTestingController, TestRequest } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { BehaviorSubject } from 'rxjs';
import { bodyText, buttonByText, hostElement, readableText, requireElement } from '@testing/dom';
import {
  calendarFeed,
  changeRequest,
  groupLesson,
  scheduleSettings,
  scheduledLesson,
} from '@testing/schedule-fixtures';
import { ScheduleApi } from '../data-access/schedule-api';
import {
  BusyTime,
  ChangeRequest,
  HistoryEntry,
  ScheduledLesson,
} from '../data-access/schedule.models';
import { ScheduleCalendar } from '../ui/schedule-calendar';
import { ScheduleAgenda } from '../ui/schedule-agenda';
import { MySchedulePage, nextMonday } from './my-schedule-page';
import { toIsoDate } from '@shared/dates/iso-date';
import { testProviders } from '@testing/setup';

describe('MySchedulePage', () => {
  let fixture: ComponentFixture<MySchedulePage>;
  let backend: HttpTestingController;

  const future = (hours: number): { startsAt: string; endsAt: string } => {
    const start = new Date(Date.now() + hours * 3_600_000);
    return {
      startsAt: start.toISOString(),
      endsAt: new Date(start.getTime() + 3_600_000).toISOString(),
    };
  };

  /** The screen: a computer unless a test says it is a phone. */
  let phone: BehaviorSubject<BreakpointState>;

  beforeEach(() => {
    // Keep future(1) on the agenda's selected day, including runs after 23:00.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 22, 12));
    phone = new BehaviorSubject<BreakpointState>({ matches: false, breakpoints: {} });
    TestBed.configureTestingModule({
      imports: [MySchedulePage],
      providers: testProviders({
        provide: BreakpointObserver,
        useValue: { observe: () => phone },
      }),
    });
    backend = TestBed.inject(HttpTestingController);
    vi.spyOn(TestBed.inject(MessageService), 'add');
    fixture = TestBed.createComponent(MySchedulePage);
  });

  afterEach(() => {
    // The teacher's busy time comes with every load of the calendar; the history with the page.
    for (const request of backend.match((r) => r.url === '/api/me/schedule/history')) {
      request.flush([]);
    }
    for (const request of busyRequests()) {
      request.flush([]);
    }
    backend.verify();
    fixture.destroy();
    vi.useRealTimers();
  });

  function busyRequests(): TestRequest[] {
    return backend.match((request) => request.url === '/api/me/schedule/busy');
  }

  function lessonRequests(): TestRequest[] {
    return backend.match((request) => request.url === '/api/me/schedule/lessons');
  }

  async function render(
    lessons: ScheduledLesson[],
    requests: ChangeRequest[] = [],
    busy: BusyTime[] = [],
    history: HistoryEntry[] = [],
  ): Promise<string> {
    fixture.detectChanges();
    backend.expectOne((r) => r.url === '/api/me/schedule/history').flush(history);
    backend.expectOne('/api/me/schedule/settings').flush(scheduleSettings());
    backend.expectOne('/api/me/schedule/requests').flush(requests);
    backend.expectOne('/api/me/schedule/feed').flush(calendarFeed());
    await fixture.whenStable();
    for (const request of lessonRequests()) {
      request.flush(lessons);
    }
    for (const request of busyRequests()) {
      request.flush(busy);
    }
    await fixture.whenStable();
    return readableText(hostElement(fixture));
  }

  it('lists upcoming lessons with the link to the online lesson', async () => {
    const text = await render([
      scheduledLesson({ ...future(24), title: 'Дроби', joinUrl: 'https://zoom.us/j/1' }),
      scheduledLesson({ id: 'l-2', ...future(48), status: 'CANCELLED' }),
      scheduledLesson({ id: 'l-0', ...future(-5) }),
    ]);

    expect(text).toContain('Ближайшие занятия');
    expect(text).toContain('Дроби');
    expect(text).toContain('Войти в урок');
    expect(text).toContain('Отменено');
    expect(
      requireElement(hostElement(fixture), 'a[href="https://zoom.us/j/1"]', HTMLAnchorElement),
    ).toBeTruthy();
    expect(hostElement(fixture).querySelectorAll('.tb-schedule-list > li').length).toBe(2);
  });

  it('opens calendar lesson details in a centered dialog on desktop', async () => {
    const lesson = scheduledLesson({ ...future(24), title: 'Desktop details' });
    await render([lesson]);
    const calendar = fixture.debugElement
      .query(By.directive(ScheduleCalendar))
      .injector.get(ScheduleCalendar);
    calendar.lessonClick.emit(lesson);
    await fixture.whenStable();
    expect(document.body.querySelector('.p-drawer.tb-d--sheet')).toBeNull();
    expect(readableText(requireElement(document.body, '.p-dialog.tb-d', HTMLElement))).toContain(
      'Desktop details',
    );
    fixture.componentInstance.closeSheet();
    await fixture.whenStable();
  });

  it('gives the calendar the teacher’s busy time, not in the list', async () => {
    const busy = future(30);
    const text = await render([], [], [{ start: busy.startsAt, end: busy.endsAt }]);

    expect(
      fixture.debugElement
        .query(By.directive(ScheduleCalendar))
        .injector.get(ScheduleCalendar)
        .busy(),
    ).toEqual([{ start: busy.startsAt, end: busy.endsAt }]);
    expect(
      fixture.debugElement
        .query(By.directive(ScheduleCalendar))
        .injector.get(ScheduleCalendar)
        .busyTitle(),
    ).toBe('Занято');
    expect(text).not.toContain('Учитель занят');
  });

  it('uses calendar and supporting panes and lets the mini-month move the calendar', async () => {
    await render([]);
    const host = hostElement(fixture);
    expect(host.querySelectorAll('tb-pane')).toHaveLength(2);
    expect(host.querySelector('tb-pane:first-child tb-schedule-calendar')).not.toBeNull();
    expect(host.querySelector('tb-pane:last-child tb-mini-month')).not.toBeNull();
    const day = requireElement(host, 'tb-mini-month button[data-date]', HTMLButtonElement);
    day.click();
    await fixture.whenStable();
    const calendar = fixture.debugElement
      .query(By.directive(ScheduleCalendar))
      .injector.get(ScheduleCalendar);
    expect(calendar.focusDate()).toBe(day.getAttribute('data-date'));
    // as the teacher's: the grid fills the free height of the pane
    expect(calendar.fillHeight()).toBe(true);
    for (const request of lessonRequests()) request.flush([]);
    for (const request of busyRequests()) request.flush([]);
  });

  it('uses the shared compact agenda and switches to week and month with lesson actions', async () => {
    phone.next({ matches: true, breakpoints: {} });
    await render([scheduledLesson({ ...future(1), title: 'Тема в повестке' })]);
    const host = hostElement(fixture);
    const agenda = fixture.debugElement
      .query(By.directive(ScheduleAgenda))
      .injector.get(ScheduleAgenda);
    expect(agenda.showStudent()).toBe(false);
    const row = requireElement(host, '.tb-agenda__row', HTMLButtonElement);
    expect(readableText(row)).toContain('Тема в повестке');
    row.click();
    await fixture.whenStable();
    expect(
      readableText(requireElement(document.body, '.p-drawer.tb-d--sheet', HTMLElement)),
    ).toContain('Перенести');
    fixture.componentInstance.closeSheet();

    buttonByText(host, 'Неделя').click();
    await fixture.whenStable();
    const calendar = fixture.debugElement
      .query(By.directive(ScheduleCalendar))
      .injector.get(ScheduleCalendar);
    expect(calendar.phoneView()).toBe('timeGridWeek');
    for (const request of lessonRequests()) request.flush([]);
    for (const request of busyRequests()) request.flush([]);

    buttonByText(host, 'Месяц').click();
    await fixture.whenStable();
    expect(
      fixture.debugElement
        .query(By.directive(ScheduleCalendar))
        .injector.get(ScheduleCalendar)
        .phoneView(),
    ).toBe('dayGridMonth');
    expect(
      fixture.debugElement.query(By.directive(ScheduleCalendar)).injector.get(ScheduleCalendar),
    ).not.toBe(calendar);
    for (const request of lessonRequests()) request.flush([]);
    for (const request of busyRequests()) request.flush([]);

    buttonByText(host, 'Повестка').click();
    await fixture.whenStable();
    expect(fixture.debugElement.query(By.directive(ScheduleAgenda))).not.toBeNull();
    for (const request of lessonRequests()) request.flush([]);
    for (const request of busyRequests()) request.flush([]);
  });

  it('says when there are no more lessons this week', async () => {
    expect(await render([])).toContain('На этой неделе занятий больше нет');
  });

  it('lists the lessons of this week only', async () => {
    const lessons = vi.spyOn(TestBed.inject(ScheduleApi), 'myLessons');
    await render([]);

    expect(lessons.mock.calls[0]).toEqual([
      toIsoDate(new Date()),
      toIsoDate(nextMonday(new Date())),
    ]);
  });

  it('shows a failed load with «Повторить», not «no lessons»', async () => {
    fixture.detectChanges();
    backend.expectOne('/api/me/schedule/requests').flush([]);
    backend.expectOne('/api/me/schedule/feed').flush(calendarFeed());
    await fixture.whenStable();
    for (const request of lessonRequests()) {
      request.flush([]);
    }
    backend
      .expectOne('/api/me/schedule/settings')
      .flush(null, { status: 500, statusText: 'Error' });
    await fixture.whenStable();

    const text = readableText(hostElement(fixture));
    expect(text).toContain('Не удалось загрузить ближайшие занятия');
    expect(text).not.toContain('На этой неделе занятий больше нет');

    buttonByText(hostElement(fixture), 'Повторить').click();
    backend.expectOne('/api/me/schedule/settings').flush(scheduleSettings());
    backend.expectOne('/api/me/schedule/requests').flush([]);
    for (const request of lessonRequests()) {
      request.flush([]);
    }
    await fixture.whenStable();

    expect(readableText(hostElement(fixture))).toContain('На этой неделе занятий больше нет');
  });

  it('shows a failed calendar with «Повторить» and no «Занятий нет» before the answer', async () => {
    await render([]);
    const calendar = fixture.debugElement
      .query(By.directive(ScheduleCalendar))
      .injector.get(ScheduleCalendar);
    expect(calendar.loaded()).toBe(true);

    fixture.componentInstance.onRange({
      from: '2026-10-05',
      to: '2026-10-12',
      current: '2026-10-05',
    });
    await fixture.whenStable();
    for (const request of busyRequests()) {
      request.flush([]);
    }
    for (const request of lessonRequests()) {
      request.flush(null, { status: 500, statusText: 'Error' });
    }
    await fixture.whenStable();

    expect(readableText(hostElement(fixture))).toContain('Не удалось загрузить календарь');
    expect(calendar.loaded()).toBe(false);
  });

  it('asks the teacher to move a lesson', async () => {
    await render([scheduledLesson({ ...future(72) })]);

    buttonByText(hostElement(fixture), 'Перенести').click();
    await fixture.whenStable();
    expect(bodyText()).toContain('Перенести занятие');

    fixture.componentInstance.onSent();
    expect(TestBed.inject(MessageService).add).toHaveBeenCalled();
    backend.expectOne('/api/me/schedule/settings').flush(scheduleSettings());
    backend.expectOne('/api/me/schedule/requests').flush([]);
    for (const request of lessonRequests()) {
      request.flush([]);
    }
  });

  it('asks to cancel a lesson', async () => {
    await render([scheduledLesson({ ...future(72) })]);

    buttonByText(hostElement(fixture), 'Отменить').click();
    await fixture.whenStable();

    expect(bodyText()).toContain('Отменить занятие');
  });

  it('shows requests and withdraws a pending one', async () => {
    const pending = changeRequest({ kind: 'CANCEL' });
    const text = await render(
      [scheduledLesson({ ...future(24), pendingRequests: [pending] })],
      [pending, changeRequest({ id: 'r-2', status: 'DECLINED', answer: 'Проведём' })],
    );

    expect(text).toContain('Запрос «Отмена» ждёт ответа учителя');
    expect(text).toContain('Мои запросы');
    // the answered request is under «Решённые», folded
    expect(text).not.toContain('Отклонено');
    const resolved = buttonByText(hostElement(fixture), 'Решённые: 1');
    expect(resolved.getAttribute('aria-expanded')).toBe('false');
    resolved.click();
    await fixture.whenStable();
    expect(resolved.getAttribute('aria-expanded')).toBe('true');
    expect(readableText(hostElement(fixture))).toContain('Отклонено');
    expect(readableText(hostElement(fixture))).toContain('Учитель: Проведём');
    expect(() => buttonByText(hostElement(fixture), 'Перенести')).toThrow();

    buttonByText(hostElement(fixture), 'Отозвать').click();
    backend.expectOne({ method: 'DELETE', url: '/api/me/schedule/requests/r-1' }).flush(null);
    backend.expectOne('/api/me/schedule/settings').flush(scheduleSettings());
    backend.expectOne('/api/me/schedule/requests').flush([]);
    for (const request of lessonRequests()) {
      request.flush([]);
    }
  });

  it('on a phone keeps the rows in one line and opens the actions in the bottom sheet', async () => {
    phone.next({ matches: true, breakpoints: {} });
    const pending = changeRequest({ kind: 'CANCEL' });
    await render(
      [
        scheduledLesson({ ...future(24), joinUrl: 'https://zoom.us/j/1' }),
        scheduledLesson({ id: 'l-2', ...future(48), pendingRequests: [pending] }),
      ],
      [pending],
    );
    const host = hostElement(fixture);
    expect(() => buttonByText(host, 'Перенести')).toThrow();
    expect(host.querySelectorAll('.tb-schedule-list .tb-i-videocam')).toHaveLength(1);
    const rows = host.querySelectorAll<HTMLButtonElement>('button[aria-label^="Занятие:"]');
    expect(rows).toHaveLength(2);

    rows[0]?.click();
    await fixture.whenStable();
    const sheet = requireElement(document.body, '.p-drawer.tb-d--sheet', HTMLElement);
    expect(readableText(sheet)).toContain('Войти в урок');
    expect(readableText(sheet)).not.toContain('Итог');
    expect(sheet.querySelector('tb-board-links')).toBeNull();
    expect(sheet.querySelector('.p-drawer-title')?.textContent).toContain('Занятие');
    expect(sheet.querySelector('a[href="https://zoom.us/j/1"]')).not.toBeNull();
    buttonByText(sheet, 'Перенести').click();
    await fixture.whenStable();
    expect(bodyText()).toContain('Перенести занятие');

    fixture.componentInstance.closeSheet();
    rows[1]?.click();
    await fixture.whenStable();
    buttonByText(
      requireElement(document.body, '.p-drawer.tb-d--sheet', HTMLElement),
      'Отозвать запрос',
    ).click();
    backend.expectOne({ method: 'DELETE', url: '/api/me/schedule/requests/r-1' }).flush(null);
    backend.expectOne('/api/me/schedule/settings').flush(scheduleSettings());
    backend.expectOne('/api/me/schedule/requests').flush([]);
    for (const request of lessonRequests()) {
      request.flush([]);
    }
  });

  it('shows group lessons and a notice that the student will not come', async () => {
    const text = await render(
      [
        groupLesson({
          ...future(72),
          participants: [
            { studentId: 's-1', studentName: null, studentAvatar: null, attendance: 'EXCUSED' },
          ],
        }),
        groupLesson({
          id: 'gl-2',
          ...future(96),
          participants: [
            { studentId: 's-1', studentName: null, studentAvatar: null, attendance: 'EXPECTED' },
          ],
        }),
      ],
      [
        changeRequest({
          id: 'r-3',
          kind: 'CANCEL',
          groupId: 'g-1',
          groupName: 'ОГЭ',
          status: 'APPROVED',
        }),
      ],
    );

    expect(text).toContain('Группа «ОГЭ»');
    expect(text).toContain('Вы предупредили, что не придёте');
    expect(text).toContain('Запросов, ждущих ответа учителя, нет');
    buttonByText(hostElement(fixture), 'Решённые: 1').click();
    await fixture.whenStable();
    expect(readableText(hostElement(fixture))).toContain('Не придёт');
    expect(readableText(hostElement(fixture))).toContain('Группа «ОГЭ»');
    buttonByText(hostElement(fixture), 'Не приду').click();
    await fixture.whenStable();
    expect(bodyText()).toContain('Не приду на занятие');
  });
});

describe('MySchedulePage lesson summaries', () => {
  let fixture: ComponentFixture<MySchedulePage>;
  let backend: HttpTestingController;

  const held = (overrides: Partial<HistoryEntry> = {}): HistoryEntry => ({
    lessonId: 'h-1',
    startsAt: new Date(Date.now() - 86_400_000).toISOString(),
    title: 'Дроби',
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
  });

  const past = (hours: number): { startsAt: string; endsAt: string } => {
    const start = new Date(Date.now() - hours * 3_600_000);
    return {
      startsAt: start.toISOString(),
      endsAt: new Date(start.getTime() + 3_600_000).toISOString(),
    };
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [MySchedulePage],
      providers: testProviders({
        provide: BreakpointObserver,
        useValue: { observe: () => new BehaviorSubject({ matches: false, breakpoints: {} }) },
      }),
    });
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(MySchedulePage);
  });

  afterEach(() => {
    for (const request of backend.match((r) => r.url === '/api/me/schedule/lessons')) {
      request.flush([]);
    }
    for (const request of backend.match((r) => r.url === '/api/me/schedule/busy')) {
      request.flush([]);
    }
    backend.verify();
    fixture.destroy();
  });

  async function start(history: HistoryEntry[], lessons: ScheduledLesson[] = []): Promise<void> {
    fixture.detectChanges();
    backend.expectOne((r) => r.url === '/api/me/schedule/history').flush(history);
    backend.expectOne('/api/me/schedule/settings').flush(scheduleSettings());
    backend.expectOne('/api/me/schedule/requests').flush([]);
    backend.expectOne('/api/me/schedule/feed').flush(calendarFeed());
    await fixture.whenStable();
    for (const request of backend.match((r) => r.url === '/api/me/schedule/lessons')) {
      request.flush(lessons);
    }
    for (const request of backend.match((r) => r.url === '/api/me/schedule/busy')) {
      request.flush([]);
    }
    await fixture.whenStable();
  }

  function historyRows(): number {
    return hostElement(fixture).querySelectorAll('ul[aria-label="История занятий"] > li').length;
  }

  it('lists the held lessons with the summary and shows the next page', async () => {
    const page = Array.from({ length: 20 }, (_, i) =>
      held({ lessonId: `h-${String(i)}`, summary: i === 0 ? 'Прошли **дроби**' : null }),
    );
    await start(page);

    expect(readableText(hostElement(fixture))).toContain('Что прошли');
    expect(hostElement(fixture).querySelector('tb-markdown strong')?.textContent).toBe('дроби');
    expect(historyRows()).toBe(20);

    buttonByText(hostElement(fixture), 'Показать ещё').click();
    const more = backend.expectOne((r) => r.url === '/api/me/schedule/history');
    expect(more.request.params.get('before')).toBe(page[19]?.startsAt);
    more.flush([held({ lessonId: 'h-last', title: 'Степени', groupId: 'g-1', groupName: 'ОГЭ' })]);
    await fixture.whenStable();

    expect(readableText(hostElement(fixture))).toContain('Степени');
    expect(readableText(hostElement(fixture))).toContain('Группа «ОГЭ»');
    expect(readableText(hostElement(fixture))).not.toContain('Показать ещё');
  });

  it('says when no lesson has been held', async () => {
    await start([]);

    expect(readableText(hostElement(fixture))).toContain('Проведённых занятий пока нет');
  });

  it('shows «Что прошли» in the sheet of a lesson that has started', async () => {
    const lesson = scheduledLesson({ id: 'l-p', ...past(2), status: 'CONDUCTED', title: 'Дроби' });
    await start([], [lesson]);

    fixture.componentInstance.openSheet(lesson);
    backend
      .expectOne('/api/me/schedule/lessons/l-p')
      .flush({ ...lesson, summary: 'Повторили дроби' });
    await fixture.whenStable();

    expect(bodyText()).toContain('Повторили дроби');
    fixture.componentInstance.closeSheet();
    await fixture.whenStable();
    expect(bodyText()).not.toContain('Повторили дроби');
  });

  it('reads no summary for a lesson ahead or a cancelled one', async () => {
    const ahead = scheduledLesson({
      id: 'l-f',
      startsAt: new Date(Date.now() + 3_600_000).toISOString(),
    });
    const cancelled = scheduledLesson({ id: 'l-c', ...past(3), status: 'CANCELLED' });
    await start([]);

    fixture.componentInstance.openSheet(ahead);
    fixture.componentInstance.openSheet(cancelled);
    await fixture.whenStable();

    backend.expectNone((r) => r.url.startsWith('/api/me/schedule/lessons/'));
  });

  it('survives a failed read of the summary', async () => {
    const lesson = scheduledLesson({ id: 'l-p', ...past(2), status: 'CONDUCTED' });
    await start([]);

    fixture.componentInstance.openSheet(lesson);
    backend
      .expectOne('/api/me/schedule/lessons/l-p')
      .flush(null, { status: 404, statusText: 'Not Found' });
    await fixture.whenStable();

    expect(bodyText()).not.toContain('Что прошли');
  });

  it('opens the lesson of the notification link', async () => {
    await TestBed.inject(Router).navigateByUrl('/?lesson=l-9');
    fixture.detectChanges();
    const lesson = scheduledLesson({ id: 'l-9', ...past(5), status: 'CONDUCTED' });
    backend.expectOne((r) => r.url === '/api/me/schedule/history').flush([]);
    backend
      .expectOne('/api/me/schedule/lessons/l-9')
      .flush({ ...lesson, summary: 'Итоги по ссылке' });
    backend.expectOne('/api/me/schedule/settings').flush(scheduleSettings());
    backend.expectOne('/api/me/schedule/requests').flush([]);
    backend.expectOne('/api/me/schedule/feed').flush(calendarFeed());
    await fixture.whenStable();

    expect(bodyText()).toContain('Итоги по ссылке');
  });

  it('ignores a link to a lesson that cannot be read', async () => {
    await TestBed.inject(Router).navigateByUrl('/?lesson=gone');
    fixture.detectChanges();
    backend.expectOne((r) => r.url === '/api/me/schedule/history').flush([]);
    backend
      .expectOne('/api/me/schedule/lessons/gone')
      .flush(null, { status: 404, statusText: 'Not Found' });
    backend.expectOne('/api/me/schedule/settings').flush(scheduleSettings());
    backend.expectOne('/api/me/schedule/requests').flush([]);
    backend.expectOne('/api/me/schedule/feed').flush(calendarFeed());
    await fixture.whenStable();

    expect(bodyText()).not.toContain('Что прошли');
  });

  it('keeps the shown history when the next page fails', async () => {
    await start(Array.from({ length: 20 }, (_, i) => held({ lessonId: `h-${String(i)}` })));

    buttonByText(hostElement(fixture), 'Показать ещё').click();
    backend
      .expectOne((r) => r.url === '/api/me/schedule/history')
      .flush(null, { status: 500, statusText: 'Error' });
    await fixture.whenStable();

    expect(historyRows()).toBe(20);
  });
});

describe('nextMonday', () => {
  it('finds the end of the week', () => {
    // 2026-09-28 is a Monday.
    expect(toIsoDate(nextMonday(new Date(2026, 8, 28, 10)))).toBe('2026-10-05');
    expect(toIsoDate(nextMonday(new Date(2026, 9, 1, 23, 30)))).toBe('2026-10-05');
    expect(toIsoDate(nextMonday(new Date(2026, 9, 4, 0, 5)))).toBe('2026-10-05');
  });
});
