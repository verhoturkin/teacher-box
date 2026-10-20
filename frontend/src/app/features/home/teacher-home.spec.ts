import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { NewMessageState } from '@core/notifications/new-message';
import { buttonByText, hostElement, readableText, requireElement } from '@testing/dom';
import { billingSummary } from '@testing/billing-fixtures';
import { reviewQueueItem } from '@testing/homework-fixtures';
import { teacherNotificationsSummary } from '@testing/notification-fixtures';
import { at, scheduleSummary, scheduledLesson } from '@testing/schedule-fixtures';
import { TeacherHome } from './teacher-home';
import { screenWidth, testProviders } from '@testing/setup';

describe('TeacherHome', () => {
  let fixture: ComponentFixture<TeacherHome>;
  let backend: HttpTestingController;

  beforeEach(() => {
    // before the lessons of the fixtures: the nearest lesson is not over
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
    vi.setSystemTime(new Date(at(2026, 10, 1, 12)));
    TestBed.configureTestingModule({
      imports: [TeacherHome],
      providers: testProviders(),
    });
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(TeacherHome);
  });

  afterEach(() => {
    fixture.destroy();
    backend.verify();
    localStorage.clear();
    vi.useRealTimers();
  });

  it('collects the widgets of the modules', async () => {
    fixture.detectChanges();
    backend.expectOne('/api/teacher/schedule/summary').flush(
      scheduleSummary({
        today: [scheduledLesson()],
        next: scheduledLesson({ topic: 'Степени' }),
        unmarked: 1,
        hasLessons: false,
      }),
    );
    backend.expectOne('/api/teacher/billing/summary').flush(billingSummary({ income: 300_000 }));
    backend
      .expectOne('/api/teacher/notifications/summary')
      .flush(teacherNotificationsSummary({ students: 0, messengerConfigured: false }));
    fixture.detectChanges();
    backend.expectOne('/api/teacher/schedule/unmarked').flush([scheduledLesson()]);
    backend.expectOne('/api/teacher/schedule/requests').flush([]);
    backend.expectOne('/api/teacher/homework/review-queue').flush([reviewQueueItem()]);
    backend.expectOne((request) => request.url === '/api/teacher/boards').flush([]);
    fixture.detectChanges();
    await fixture.whenStable();

    const text = readableText(hostElement(fixture));
    expect(text).toContain('Следующее занятие');
    expect(text).toContain('Степени');
    expect(text).toContain('С чего начать');
    expect(text).toContain('Сделано 1 из 4');
    expect(text).toContain('Иван Петров');
    expect(text).toContain('Нужно сделать');
    expect(text).toContain('Проверить: Дроби');
    expect(text).toContain('Поступило за сентябрь 3 000 ₽');
    expect(text).not.toContain('Сегодня занятий нет');
    // one column (ADR-0021): the widgets one under another, no «Сегодня»
    const widgets = Array.from(
      hostElement(fixture).querySelectorAll(':scope > .tb-stack > *'),
      (widget) => widget.tagName.toLowerCase(),
    );
    expect(widgets).toEqual(['tb-upcoming-lesson-widget', 'tb-todo-queue', 'tb-finance-widget']);
  });

  it('shows a failed load once with «Повторить» instead of the widgets', async () => {
    fixture.detectChanges();
    backend.expectOne('/api/teacher/billing/summary').flush(billingSummary());
    backend.expectOne('/api/teacher/notifications/summary').flush(teacherNotificationsSummary());
    backend
      .expectOne('/api/teacher/schedule/summary')
      .flush(null, { status: 500, statusText: 'Error' });
    fixture.detectChanges();
    await fixture.whenStable();

    const text = readableText(hostElement(fixture));
    expect(text).toContain('Не удалось загрузить занятия, задания, уведомления и финансы');
    expect(text).not.toContain('Нужно сделать');
  });

  it('reloads the schedule counters', async () => {
    fixture.detectChanges();
    backend.expectOne('/api/teacher/schedule/summary').flush(scheduleSummary({ unmarked: 1 }));
    backend.expectOne('/api/teacher/billing/summary').flush(billingSummary());
    backend.expectOne('/api/teacher/notifications/summary').flush(teacherNotificationsSummary());
    fixture.detectChanges();
    backend.expectOne('/api/teacher/schedule/unmarked').flush([]);
    backend.expectOne('/api/teacher/schedule/requests').flush([]);
    backend.expectOne('/api/teacher/homework/review-queue').flush([]);

    fixture.componentInstance.loadSchedule();
    backend.expectOne('/api/teacher/schedule/summary').flush(scheduleSummary());
    fixture.detectChanges();
    await fixture.whenStable();

    expect(readableText(hostElement(fixture))).toContain('Нужно сделать');
  });
});

describe('TeacherHome on a phone', () => {
  it('«Создать › Сообщение» of the home page’s FAB menu opens the dialog of a new message', async () => {
    TestBed.configureTestingModule({
      imports: [TeacherHome],
      providers: testProviders(screenWidth(599)),
    });
    const fixture = TestBed.createComponent(TeacherHome);
    await fixture.whenStable();
    const host = hostElement(fixture);

    requireElement(host, 'tb-fab-menu .tb-fab-menu__button', HTMLButtonElement).click();
    await fixture.whenStable();
    buttonByText(host, 'Сообщение').click();
    await fixture.whenStable();

    expect(TestBed.inject(NewMessageState).open()).toBe(true);
    expect(TestBed.inject(Router).url).toBe('/');
    TestBed.inject(HttpTestingController).match(() => true);
    fixture.destroy();
  });
});
