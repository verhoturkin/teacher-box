import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { MessageService } from 'primeng/api';
import { providePrimeNG } from 'primeng/config';
import { bodyText, buttonByText, hostElement, readableText } from '@testing/dom';
import {
  calendarFeed,
  changeRequest,
  lessonSeries,
  scheduleSettings,
  scheduledLesson,
} from '@testing/schedule-fixtures';
import { ScheduledLesson } from '../data-access/schedule.models';
import { LessonMove } from '../ui/schedule-calendar';
import { LessonDialog } from './lesson-dialog';
import { SchedulePage } from './schedule-page';

describe('SchedulePage', () => {
  let fixture: ComponentFixture<SchedulePage>;
  let backend: HttpTestingController;
  let page: SchedulePage;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [SchedulePage],
      providers: [provideHttpClient(), provideHttpClientTesting(), providePrimeNG(), MessageService],
    });
    backend = TestBed.inject(HttpTestingController);
    vi.spyOn(TestBed.inject(MessageService), 'add');
    fixture = TestBed.createComponent(SchedulePage);
    page = fixture.componentInstance;
  });

  afterEach(() => {
    backend.verify();
    fixture.destroy();
  });

  function lessonsRequest(): TestRequest {
    return backend.expectOne((request) => request.url === '/api/teacher/schedule/lessons');
  }

  function flushSidePanels(unmarked: ScheduledLesson[] = []): void {
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
  ): Promise<string> {
    fixture.detectChanges();
    backend.expectOne('/api/me/schedule/settings').flush(settings);
    backend.expectOne('/api/teacher/students').flush([
      { id: 's-1', displayName: 'Иван Петров', status: 'ACTIVE' },
      { id: 's-2', displayName: 'Ушедший', status: 'DEACTIVATED' },
    ]);
    flushSidePanels(unmarked);
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
    const text = await render(scheduleSettings(), [scheduledLesson({ id: 'l-9', studentName: 'Мария' })]);

    expect(text).toContain('Запросы учеников');
    expect(text).toContain('Перенос');
    expect(text).toContain('Отметьте прошедшие занятия');
    expect(text).toContain('Мария');
    expect(text).toContain('Регулярные занятия');
    expect(text).toContain('Вт, Чт в 18:00');
    expect(text).not.toContain('часовому поясу этого устройства');
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

  it('explains times when the portal is in another time zone', async () => {
    const text = await render(scheduleSettings({ timeZone: 'Pacific/Chatham' }));

    expect(text).toContain('расписание портала — Pacific/Chatham');
  });

  it('plans a lesson in a selected slot with the default or the selected duration', async () => {
    await render(scheduleSettings({ defaultDurationMinutes: 45 }));
    const dialog = fixture.debugElement.query(By.directive(LessonDialog)).injector.get(LessonDialog);
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
      .flush({ status: 422, code: 'schedule.lesson-not-scheduled' }, { status: 422, statusText: 'Unprocessable' });
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
    expect(backend.expectOne('/api/teacher/schedule/lessons/l-9/outcome').request.body).toEqual({ outcome: 'MISSED' });
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
    expect(stop.request.body).toEqual({ from: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) as unknown });
    stop.flush(null);
    await flushReload();
  });
});
