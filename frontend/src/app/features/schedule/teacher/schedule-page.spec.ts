import { HttpTestingController, TestRequest } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ConfirmationService, MessageService } from 'primeng/api';
import { bodyText, buttonByText, hostElement, readableText } from '@testing/dom';
import { aGroup } from '@testing/identity-fixtures';
import {
  at,
  calendarFeed,
  changeRequest,
  groupLesson,
  lessonSeries,
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
import { testProviders } from '@testing/setup';

describe('SchedulePage', () => {
  let fixture: ComponentFixture<SchedulePage>;
  let backend: HttpTestingController;
  let page: SchedulePage;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [SchedulePage],
      providers: testProviders(),
    });
    backend = TestBed.inject(HttpTestingController);
    vi.spyOn(TestBed.inject(MessageService), 'add');
    fixture = TestBed.createComponent(SchedulePage);
    page = fixture.componentInstance;
  });

  afterEach(() => {
    // Boards of the lesson in its card (covered by the card's own tests).
    for (const request of backend.match('/api/teacher/boards')) {
      request.flush([]);
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
    backend.expectOne('/api/teacher/schedule/series').flush([lessonSeries()]);
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
    backend.expectOne('/api/me/schedule/feed').flush(calendarFeed());
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

  function move(revert = vi.fn()): LessonMove {
    return { lesson: scheduledLesson(), startsAt: new Date(2026, 9, 2, 17), revert };
  }

  it('shows requests, lessons to mark and regular series', async () => {
    const text = await render(scheduleSettings(), [
      scheduledLesson({ id: 'l-9', studentName: 'Мария' }),
    ]);

    expect(text).toContain('Запросы учеников');
    expect(text).toContain('Перенос');
    expect(text).toContain('Отметьте прошедшие занятия');
    expect(text).toContain('Мария');
    expect(text).toContain('Регулярные занятия');
    expect(text).toContain('Вт, Чт в 18:00');
    expect(text).not.toContain('часовому поясу этого устройства');
  });

  it('offers groups with students and marks a group lesson in its card', async () => {
    const text = await render(scheduleSettings(), [
      groupLesson({ id: 'gl-9', startsAt: at(2026, 9, 1, 18), endsAt: at(2026, 9, 1, 19, 30) }),
    ]);
    const dialog = fixture.debugElement
      .query(By.directive(LessonDialog))
      .injector.get(LessonDialog);

    expect(dialog.groups()).toEqual([{ id: 'g-1', name: 'ОГЭ' }]);
    expect(text).toContain('Группа «ОГЭ»');
    buttonByText(hostElement(fixture), 'Отметить посещаемость: Группа «ОГЭ»').click();
    await fixture.whenStable();
    expect(bodyText()).toContain('Мария');
    expect(bodyText()).toContain('Отметить посещаемость');
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

    buttonByText(hostElement(fixture), 'Нерабочее время').click();
    await fixture.whenStable();
    expect(dialog.visible()).toBe(true);
    expect(dialog.offTime()).toBeNull();
    dialog.visible.set(false);

    buttonByText(hostElement(fixture), 'Изменить нерабочее время: Пн, Ср 13:00–14:00').click();
    await fixture.whenStable();
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
      expect.objectContaining({ summary: 'Нерабочее время сохранено' }),
    );

    const confirmation = fixture.debugElement.injector.get(ConfirmationService);
    vi.spyOn(confirmation, 'confirm').mockImplementationOnce((options) => {
      expect(options.message).toContain('Пн, Ср 13:00–14:00');
      options.accept?.();
      return confirmation;
    });
    buttonByText(hostElement(fixture), 'Удалить нерабочее время: Пн, Ср 13:00–14:00').click();
    backend
      .expectOne({ method: 'DELETE', url: '/api/teacher/schedule/off-times/off-1' })
      .flush(null);
    backend.expectOne('/api/teacher/schedule/off-times').flush([]);
    await fixture.whenStable();
    expect(readableText(hostElement(fixture))).toContain('Отметьте обед');
  });

  it('explains times when the portal is in another time zone', async () => {
    const text = await render(scheduleSettings({ timeZone: 'Pacific/Chatham' }));

    expect(text).toContain('расписание портала — Pacific/Chatham');
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
  });

  it('opens a new lesson from the home page', async () => {
    fixture.componentRef.setInput('create', 'lesson');
    await render();

    expect(
      fixture.debugElement.query(By.directive(LessonDialog)).injector.get(LessonDialog).visible(),
    ).toBe(true);
  });

  it('opens a new lesson, a lesson card and the editor', async () => {
    await render();
    buttonByText(hostElement(fixture), 'Занятие').click();
    await fixture.whenStable();
    expect(bodyText()).toContain('Новое занятие');

    page.openLesson(scheduledLesson({ topic: 'Логарифмы' }));
    await fixture.whenStable();
    expect(bodyText()).toContain('Тема: Логарифмы');

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
      topic: null,
      meetingUrl: null,
      allowOverlap: false,
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

  it('marks past lessons from the list', async () => {
    await render(scheduleSettings(), [scheduledLesson({ id: 'l-9' })]);

    buttonByText(hostElement(fixture), 'Проведено: Иван Петров').click();
    const request = backend.expectOne('/api/teacher/schedule/lessons/l-9/outcome');
    expect(request.request.body).toEqual({ outcome: 'CONDUCTED' });
    request.flush(scheduledLesson({ status: 'CONDUCTED' }));
    await flushReload([scheduledLesson({ id: 'l-9' })]);

    buttonByText(hostElement(fixture), 'Пропуск: Иван Петров').click();
    expect(backend.expectOne('/api/teacher/schedule/lessons/l-9/outcome').request.body).toEqual({
      outcome: 'MISSED',
    });
  });

  it('opens a request for an answer', async () => {
    await render();

    buttonByText(hostElement(fixture), 'Ответить').click();
    await fixture.whenStable();

    expect(bodyText()).toContain('Запрос ученика');
  });

  it('plans, changes and stops regular lessons', async () => {
    await render();
    buttonByText(hostElement(fixture), 'Регулярные занятия').click();
    await fixture.whenStable();
    expect(bodyText()).toContain('Дни недели');

    buttonByText(hostElement(fixture), 'Изменить расписание: Иван Петров').click();
    await fixture.whenStable();
    expect(bodyText()).toContain('Изменить регулярные занятия');

    page.onSeriesSaved({ series: lessonSeries(), lessons: 12 });
    expect(TestBed.inject(MessageService).add).toHaveBeenCalledWith(
      expect.objectContaining({ detail: 'Запланировано занятий: 12' }),
    );
    await flushReload();

    buttonByText(hostElement(fixture), 'Завершить расписание: Иван Петров').click();
    await fixture.whenStable();
    buttonByText(document.body, 'Завершить').click();
    const stop = backend.expectOne('/api/teacher/schedule/series/sr-1/stop');
    expect(stop.request.body).toEqual({
      from: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) as unknown,
    });
    stop.flush(null);
    await flushReload();
  });
});
