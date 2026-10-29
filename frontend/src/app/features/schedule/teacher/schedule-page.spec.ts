import { BreakpointObserver, BreakpointState } from '@angular/cdk/layout';
import { HttpTestingController, TestRequest } from '@angular/common/http/testing';
import { BehaviorSubject } from 'rxjs';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { By } from '@angular/platform-browser';
import { ConfirmationService, MessageService } from 'primeng/api';
import { bodyText, buttonByText, hostElement, menuItemByText, readableText } from '@testing/dom';
import { aGroup } from '@testing/identity-fixtures';
import {
  at,
  changeRequest,
  onceOffTime,
  scheduleSettings,
  scheduledLesson,
  weeklyOffTime,
} from '@testing/schedule-fixtures';
import { OffTime, ScheduledLesson } from '../data-access/schedule.models';
import { LessonMove, ScheduleCalendar } from '../ui/schedule-calendar';
import { LessonDialog } from './lesson-dialog';
import { OffTimeDialog } from './off-time-dialog';
import { SchedulePage } from './schedule-page';
import { testProviders, ConfirmHost } from '@testing/setup';

describe('SchedulePage', () => {
  let fixture: ComponentFixture<SchedulePage>;
  let backend: HttpTestingController;
  let page: SchedulePage;
  /** The screen: a computer unless a test says it is a phone. */
  let phone: BehaviorSubject<BreakpointState>;

  beforeEach(() => {
    phone = new BehaviorSubject<BreakpointState>({ matches: false, breakpoints: {} });
    TestBed.configureTestingModule({
      imports: [SchedulePage],
      providers: testProviders({ provide: BreakpointObserver, useValue: { observe: () => phone } }),
    });
    backend = TestBed.inject(HttpTestingController);
    vi.spyOn(TestBed.inject(MessageService), 'add');
    TestBed.createComponent(ConfirmHost).detectChanges();
    fixture = TestBed.createComponent(SchedulePage);
    page = fixture.componentInstance;
  });

  afterEach(() => {
    // Boards of the lesson in its card (covered by the card's own tests).
    for (const request of backend.match((request) => request.url === '/api/teacher/boards')) {
      request.flush([]);
    }
    // the details of the opened lesson (covered by the card's own tests)
    for (const request of backend.match((request) =>
      /^\/api\/teacher\/schedule\/lessons\/[^/]+$/.test(request.url),
    )) {
      request.flush({});
    }
    // the summary of an opened past lesson asks whether the AI draft is on
    for (const request of backend.match('/api/teacher/ai/status')) {
      request.flush({ enabled: false });
    }
    for (const request of offTimePeriodRequests()) {
      request.flush([]);
    }
    backend.verify();
    fixture.destroy();
  });

  function lessonsRequest(): TestRequest {
    return backend.expectOne((request) => request.url === '/api/teacher/schedule/lessons');
  }

  function offTimePeriodRequests(): TestRequest[] {
    return backend.match((request) => request.url === '/api/teacher/schedule/off-times/periods');
  }

  function flushSidePanels(unmarked: ScheduledLesson[] = [], offTimes: OffTime[] = []): void {
    backend.expectOne('/api/teacher/schedule/off-times').flush(offTimes);
    backend.expectOne('/api/teacher/schedule/requests').flush([changeRequest({ late: true })]);
    backend.expectOne('/api/teacher/schedule/unmarked').flush(unmarked);
  }

  async function render(
    settings = scheduleSettings(),
    unmarked: ScheduledLesson[] = [],
    google: { status: 'CONNECTED' | 'NOT_CONNECTED'; busyEnabled: boolean } = {
      status: 'NOT_CONNECTED',
      busyEnabled: false,
    },
    offTimes: OffTime[] = [],
  ): Promise<string> {
    fixture.detectChanges();
    backend.expectOne('/api/me/schedule/settings').flush(settings);
    backend.expectOne('/api/teacher/students').flush([
      { id: 's-1', displayName: 'Иван Петров', status: 'ACTIVE' },
      { id: 's-2', displayName: 'Ушедший', status: 'DEACTIVATED' },
    ]);
    backend
      .expectOne('/api/teacher/groups')
      .flush([
        aGroup({ id: 'g-1', name: 'ОГЭ' }),
        aGroup({ id: 'g-2', name: 'Пустая', members: [] }),
        aGroup({ id: 'g-3', name: 'Архив', archivedAt: '2026-09-01T10:00:00Z' }),
      ]);
    flushSidePanels(unmarked, offTimes);
    backend.expectOne('/api/teacher/schedule/google').flush(google);
    await fixture.whenStable();
    lessonsRequest().flush([scheduledLesson()]);
    await fixture.whenStable();
    return readableText(hostElement(fixture));
  }

  async function flushReload(unmarked: ScheduledLesson[] = []): Promise<void> {
    lessonsRequest().flush([scheduledLesson()]);
    flushSidePanels(unmarked);
    await fixture.whenStable();
  }

  /** Opens «⋮» of a row and picks the item. */
  async function act(name: string, item: string): Promise<void> {
    const more = buttonByText(hostElement(fixture), `Действия: ${name}`);
    expect(more.getAttribute('aria-haspopup')).toBe('menu');
    more.click();
    await fixture.whenStable();
    menuItemByText(item).click();
    await fixture.whenStable();
  }

  function move(revert = vi.fn()): LessonMove {
    return { lesson: scheduledLesson(), startsAt: new Date(2026, 9, 2, 17), revert };
  }

  it('shows requests and time off; unmarked lessons are outlined in the grid, not in a card', async () => {
    const text = await render(scheduleSettings(), [
      scheduledLesson({ id: 'l-9', studentName: 'Мария' }),
    ]);

    expect(text).toContain('Запросы учеников');
    expect(text).toContain('Перенос');
    expect(text).not.toContain('Отметьте прошедшие занятия');
    expect(text).not.toContain('Мария');
    expect(
      fixture.debugElement
        .query(By.directive(ScheduleCalendar))
        .injector.get(ScheduleCalendar)
        .unmarked(),
    ).toHaveLength(1);
    expect(text).not.toContain('Регулярные');
    expect(text).toContain('Нерабочее время');
    expect(text).not.toContain('часовому поясу этого устройства');
  });

  it('shows failed loads of each section with «Повторить», not «nothing here»', async () => {
    fixture.detectChanges();
    backend.expectOne('/api/me/schedule/settings').flush(scheduleSettings());
    backend.expectOne('/api/teacher/students').flush([]);
    backend.expectOne('/api/teacher/groups').flush([]);
    const failure = { status: 500, statusText: 'Error' };
    backend.expectOne('/api/teacher/schedule/off-times').flush(null, failure);
    backend.expectOne('/api/teacher/schedule/unmarked').flush([]);
    backend.expectOne('/api/teacher/schedule/requests').flush(null, failure);
    backend
      .expectOne('/api/teacher/schedule/google')
      .flush({ status: 'NOT_CONNECTED', busyEnabled: false });
    await fixture.whenStable();
    lessonsRequest().flush(null, failure);
    await fixture.whenStable();

    const text = readableText(hostElement(fixture));
    expect(text).toContain('Не удалось загрузить запросы и прошедшие занятия');
    expect(text).toContain('Не удалось загрузить занятия');
    expect(text).toContain('Не удалось загрузить нерабочее время');
    const calendar = fixture.debugElement
      .query(By.directive(ScheduleCalendar))
      .injector.get(ScheduleCalendar);
    expect(calendar.loaded()).toBe(false);

    for (const button of Array.from(
      hostElement(fixture).querySelectorAll<HTMLButtonElement>('.tb-load-state__error button'),
    )) {
      button.click();
    }
    backend.expectOne('/api/teacher/schedule/requests').flush([]);
    backend.expectOne('/api/teacher/schedule/unmarked').flush([]);
    lessonsRequest().flush([]);
    backend.expectOne('/api/teacher/schedule/off-times').flush([]);
    await fixture.whenStable();

    expect(calendar.loaded()).toBe(true);
  });

  it('shows busy times from the teacher’s Google Calendar', async () => {
    await render(scheduleSettings(), [], { status: 'CONNECTED', busyEnabled: true });

    const busy = backend.match((request) => request.url === '/api/teacher/schedule/google/busy');
    expect(busy.length).toBeGreaterThan(0);
    for (const request of busy) {
      expect(request.request.params.get('from')).toMatch(/Z$/);
      request.flush([{ start: '2026-10-01T09:00:00Z', end: '2026-10-01T10:00:00Z' }]);
    }
  });

  it('shows the teacher’s off time in the card and in the calendar', async () => {
    const text = await render(scheduleSettings(), [], undefined, [weeklyOffTime(), onceOffTime()]);

    expect(text).toContain('Нерабочее время');
    expect(text).toContain('Обед');
    expect(text).toContain('Пн, Ср 13:00–14:00');
    expect(text).toContain('Не работаю');
    const periods = offTimePeriodRequests();
    expect(periods.length).toBeGreaterThan(0);
    for (const request of periods) {
      expect(request.request.params.get('from')).toMatch(/Z$/);
      request.flush([
        { offTimeId: 'off-1', start: at(2026, 10, 5, 13), end: at(2026, 10, 5, 14), note: 'Обед' },
      ]);
    }
    await fixture.whenStable();
    expect(
      fixture.debugElement
        .query(By.directive(ScheduleCalendar))
        .injector.get(ScheduleCalendar)
        .offTime(),
    ).toHaveLength(1);
  });

  it('says what off time is for while there is none', async () => {
    expect(await render()).toContain('Отметьте обед, выходные или отпуск');
  });

  it('adds, changes and deletes off time', async () => {
    await render(scheduleSettings(), [], undefined, [weeklyOffTime()]);
    for (const request of offTimePeriodRequests()) {
      request.flush([]);
    }
    const dialog = fixture.debugElement
      .query(By.directive(OffTimeDialog))
      .injector.get(OffTimeDialog);

    buttonByText(hostElement(fixture), 'Добавить нерабочее время').click();
    await fixture.whenStable();
    expect(dialog.visible()).toBe(true);
    expect(dialog.offTime()).toBeNull();
    dialog.visible.set(false);

    await act('Пн, Ср 13:00–14:00', 'Изменить');
    expect(dialog.offTime()).toEqual(weeklyOffTime());
    dialog.visible.set(false);
    dialog.saved.emit(weeklyOffTime({ note: 'Перерыв' }));
    backend
      .expectOne('/api/teacher/schedule/off-times')
      .flush([weeklyOffTime({ note: 'Перерыв' })]);
    expect(offTimePeriodRequests()).toHaveLength(1);
    await fixture.whenStable();
    expect(readableText(hostElement(fixture))).toContain('Перерыв');
    expect(TestBed.inject(MessageService).add).toHaveBeenCalledWith(
      expect.objectContaining({ detail: 'Нерабочее время сохранено' }),
    );

    const confirmation = fixture.debugElement.injector.get(ConfirmationService);
    vi.spyOn(confirmation, 'confirm').mockImplementationOnce((options) => {
      expect(options.message).toContain('Пн, Ср 13:00–14:00');
      options.accept?.();
      return confirmation;
    });
    await act('Пн, Ср 13:00–14:00', 'Удалить…');
    backend
      .expectOne({ method: 'DELETE', url: '/api/teacher/schedule/off-times/off-1' })
      .flush(null);
    backend.expectOne('/api/teacher/schedule/off-times').flush([]);
    await fixture.whenStable();
    expect(readableText(hostElement(fixture))).toContain('Отметьте обед');
  });

  it('explains times when the portal is in another time zone', async () => {
    const text = await render(scheduleSettings({ timeZone: 'Pacific/Chatham' }));

    expect(text).toContain('Часовой пояс портала: Pacific/Chatham');
    expect(hostElement(fixture).querySelector('.tb-assist-chip')?.getAttribute('title')).toContain(
      'расписание портала — Pacific/Chatham',
    );
  });

  it('filters the calendar by a student or a group and goes to a day of the mini-month', async () => {
    await render();
    const host = hostElement(fixture);
    const calendar = fixture.debugElement
      .query(By.directive(ScheduleCalendar))
      .injector.get(ScheduleCalendar);
    const chip = (name: string): HTMLButtonElement => {
      const found = Array.from(
        host.querySelectorAll<HTMLButtonElement>('tb-filter-chips button'),
      ).find((button) => button.textContent.includes(name));
      if (found === undefined) {
        throw new Error(`No chip ${name}`);
      }
      return found;
    };

    expect(calendar.lessons()).toHaveLength(1);
    chip('ОГЭ').click();
    await fixture.whenStable();
    expect(calendar.lessons()).toHaveLength(0);
    chip('Иван Петров').click();
    await fixture.whenStable();
    expect(calendar.lessons()).toHaveLength(1);
    chip('Все').click();
    await fixture.whenStable();
    expect(calendar.lessons()).toHaveLength(1);

    host.querySelector<HTMLButtonElement>('tb-mini-month [data-date="2026-10-14"]')?.click();
    await fixture.whenStable();
    expect(calendar.focusDate()).toBe('2026-10-14');
    // the calendar moved: the lessons of the new range are asked for
    for (const request of backend.match(
      (request) => request.url === '/api/teacher/schedule/lessons',
    )) {
      request.flush([]);
    }
  });

  it('has no zone chip in the portal zone and offers time off directly', async () => {
    await render();
    const host = hostElement(fixture);

    expect(host.querySelector('.tb-assist-chip')).toBeNull();
    expect(host.querySelector('p-tabs')).toBeNull();
    buttonByText(host, 'Добавить нерабочее время').click();
    await fixture.whenStable();
    expect(bodyText()).toContain('Нерабочее время');
  });

  it('plans a lesson in a selected slot with the default or the selected duration', async () => {
    await render(scheduleSettings({ defaultDurationMinutes: 45 }));
    const dialog = fixture.debugElement
      .query(By.directive(LessonDialog))
      .injector.get(LessonDialog);
    const start = new Date(2026, 9, 1, 18);

    page.onSlot({ start, end: new Date(2026, 9, 1, 18, 30) });
    await fixture.whenStable();
    expect(dialog.form.controls.durationMinutes.value).toBe(45);
    expect(dialog.form.controls.startsAt.value).toEqual(start);
    expect(bodyText()).toContain('Новое занятие');

    page.onSlot({ start, end: new Date(2026, 9, 1, 19, 30) });
    await fixture.whenStable();
    expect(dialog.form.controls.durationMinutes.value).toBe(90);

    // a day of the month view: the whole day is not a duration
    page.onSlot({ start: new Date(2026, 9, 2), end: new Date(2026, 9, 3), allDay: true });
    await fixture.whenStable();
    expect(dialog.form.controls.durationMinutes.value).toBe(45);
    expect(dialog.form.controls.startsAt.value).toEqual(new Date(2026, 9, 2, 10));
  });

  it('opens a new lesson from «Создать» and drops ?create', async () => {
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/?create=lesson');
    await render();
    await fixture.whenStable();
    expect(router.url).toBe('/');

    expect(
      fixture.debugElement.query(By.directive(LessonDialog)).injector.get(LessonDialog).visible(),
    ).toBe(true);
  });

  it('opens a new lesson, a lesson card and the editor', async () => {
    await render();
    await TestBed.inject(Router).navigateByUrl('/?create=lesson');
    await fixture.whenStable();
    expect(bodyText()).toContain('Новое занятие');

    page.openLesson(scheduledLesson({ title: 'Логарифмы' }));
    await fixture.whenStable();
    expect(bodyText()).toContain('Логарифмы');

    page.editLesson(scheduledLesson());
    await fixture.whenStable();
    expect(bodyText()).toContain('Изменить занятие');
  });

  it('moves a dragged lesson', async () => {
    await render();

    page.onMove(move());

    const request = backend.expectOne({ method: 'PUT', url: '/api/teacher/schedule/lessons/l-1' });
    expect(request.request.body).toEqual({
      startsAt: new Date(2026, 9, 2, 17).toISOString(),
      durationMinutes: 60,
      title: null,
      topic: null,
      meetingUrl: null,
      allowOverlap: false,
      scope: 'ONLY',
      version: 0,
      repeatVersion: null,
    });
    request.flush(scheduledLesson());
    await flushReload();
  });

  it('asks before moving a lesson onto another one', async () => {
    await render();
    const revert = vi.fn();

    page.onMove(move(revert));
    backend
      .expectOne('/api/teacher/schedule/lessons/l-1')
      .flush({ status: 409, code: 'schedule.overlap' }, { status: 409, statusText: 'Conflict' });
    await fixture.whenStable();
    expect(bodyText()).toContain('В это время уже есть другое занятие');
    buttonByText(document.body, 'Перенести').click();
    await fixture.whenStable();

    const retry = backend.expectOne('/api/teacher/schedule/lessons/l-1');
    expect(retry.request.body).toEqual(expect.objectContaining({ allowOverlap: true }));
    retry.flush(scheduledLesson());
    await flushReload();
    expect(revert).not.toHaveBeenCalled();
  });

  it('puts a lesson back when the move is refused or fails', async () => {
    await render();
    const revert = vi.fn();

    page.onMove(move(revert));
    backend
      .expectOne('/api/teacher/schedule/lessons/l-1')
      .flush({ status: 409, code: 'schedule.overlap' }, { status: 409, statusText: 'Conflict' });
    await fixture.whenStable();
    buttonByText(document.body, 'Отмена').click();
    await fixture.whenStable();
    expect(revert).toHaveBeenCalledTimes(1);

    page.onMove(move(revert));
    backend
      .expectOne('/api/teacher/schedule/lessons/l-1')
      .flush(
        { status: 422, code: 'schedule.lesson-not-scheduled' },
        { status: 422, statusText: 'Unprocessable' },
      );
    expect(revert).toHaveBeenCalledTimes(2);
    expect(TestBed.inject(MessageService).add).toHaveBeenCalledWith(
      expect.objectContaining({ detail: 'Занятие уже проведено или отменено' }),
    );
  });

  it('tells that a lesson was saved: the new lesson may be out of the screen', async () => {
    await render();

    fixture.debugElement
      .query(By.directive(LessonDialog))
      .injector.get(LessonDialog)
      .saved.emit(scheduledLesson());
    await flushReload([]);

    expect(TestBed.inject(MessageService).add).toHaveBeenCalledWith(
      expect.objectContaining({ detail: 'Занятие сохранено' }),
    );
  });

  it('opens a request for an answer', async () => {
    await render();

    buttonByText(hostElement(fixture), 'Ответить').click();
    await fixture.whenStable();

    expect(bodyText()).toContain('Запрос ученика');
  });
});
