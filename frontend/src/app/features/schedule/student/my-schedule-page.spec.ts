import { BreakpointObserver, BreakpointState } from '@angular/cdk/layout';
import { HttpTestingController, TestRequest } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
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
import { BusyTime, ChangeRequest, ScheduledLesson } from '../data-access/schedule.models';
import { ScheduleCalendar } from '../ui/schedule-calendar';
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
    // The teacher's busy time comes with every load of the calendar.
    for (const request of busyRequests()) {
      request.flush([]);
    }
    backend.verify();
    fixture.destroy();
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
  ): Promise<string> {
    fixture.detectChanges();
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
      scheduledLesson({ ...future(24), topic: 'Дроби', joinUrl: 'https://zoom.us/j/1' }),
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

    fixture.componentInstance.onRange({ from: '2026-10-05', to: '2026-10-12' });
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
    expect(text).toContain('Отклонено');
    expect(text).toContain('Учитель: Проведём');
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
    expect(host.querySelectorAll('.tb-schedule-list .pi-video')).toHaveLength(1);
    const rows = host.querySelectorAll<HTMLButtonElement>('button[aria-label^="Занятие:"]');
    expect(rows).toHaveLength(2);

    rows[0]?.click();
    await fixture.whenStable();
    const sheet = requireElement(document.body, '.p-drawer.tb-sheet', HTMLElement);
    expect(readableText(sheet)).toContain('Войти в урок');
    expect(sheet.querySelector('a[href="https://zoom.us/j/1"]')).not.toBeNull();
    buttonByText(sheet, 'Перенести').click();
    await fixture.whenStable();
    expect(bodyText()).toContain('Перенести занятие');

    fixture.componentInstance.closeSheet();
    rows[1]?.click();
    await fixture.whenStable();
    buttonByText(
      requireElement(document.body, '.p-drawer.tb-sheet', HTMLElement),
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
          participants: [{ studentId: 's-1', studentName: null, attendance: 'EXCUSED' }],
        }),
        groupLesson({
          id: 'gl-2',
          ...future(96),
          participants: [{ studentId: 's-1', studentName: null, attendance: 'EXPECTED' }],
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
    expect(text).toContain('Не придёт');
    expect(text).toContain('группа «ОГЭ»');
    buttonByText(hostElement(fixture), 'Не приду').click();
    await fixture.whenStable();
    expect(bodyText()).toContain('Не приду на занятие');
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
