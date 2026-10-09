import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { hostElement, readableText } from '@testing/dom';
import { billingSummary } from '@testing/billing-fixtures';
import { homeworkSummary } from '@testing/homework-fixtures';
import { notificationPage, teacherNotificationsSummary } from '@testing/notification-fixtures';
import { scheduleSummary, scheduledLesson } from '@testing/schedule-fixtures';
import { TeacherHome } from './teacher-home';
import { testProviders } from '@testing/setup';

describe('TeacherHome', () => {
  let fixture: ComponentFixture<TeacherHome>;
  let backend: HttpTestingController;

  beforeEach(() => {
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
    backend.expectOne('/api/teacher/homework/summary').flush(homeworkSummary({ toReview: 2 }));
    backend.expectOne('/api/teacher/billing/summary').flush(billingSummary({ income: 300_000 }));
    backend
      .expectOne('/api/teacher/notifications/summary')
      .flush(teacherNotificationsSummary({ students: 0, messengerConfigured: false }));
    fixture.detectChanges();
    backend.expectOne('/api/me/notifications?page=0&size=5&read=false').flush(notificationPage([]));
    backend.expectOne((request) => request.url === '/api/teacher/boards').flush([]);
    fixture.detectChanges();
    await fixture.whenStable();

    const text = readableText(hostElement(fixture));
    expect(text).toContain('Занятие Оплата Ученик Задание');
    expect(text).toContain('Следующее занятие');
    expect(text).toContain('Степени');
    expect(text).toContain('С чего начать');
    expect(text).toContain('Сделано 1 из 4');
    expect(text).toContain('Иван Петров');
    expect(text).toContain('Отметьте прошедшие занятия 1');
    expect(text).toContain('Работы на проверку 2');
    expect(text).toContain('Поступило за сентябрь 3 000 ₽');
    expect(text).toContain('Новых уведомлений нет');
    // one column (ADR-0021): the widgets one under another, today first
    const widgets = Array.from(
      hostElement(fixture).querySelectorAll(':scope > .tb-stack > *'),
      (widget) => widget.tagName.toLowerCase(),
    );
    expect(widgets).toEqual([
      'tb-quick-actions',
      'tb-upcoming-lesson-widget',
      'tb-first-run-checklist',
      'tb-today-lessons-widget',
      'tb-attention-card',
      'tb-latest-notifications-widget',
      'tb-finance-widget',
    ]);
  });

  it('shows a failed load once with «Повторить» instead of the widgets', async () => {
    fixture.detectChanges();
    backend.expectOne('/api/teacher/homework/summary').flush(homeworkSummary());
    backend.expectOne('/api/teacher/billing/summary').flush(billingSummary());
    backend.expectOne('/api/teacher/notifications/summary').flush(teacherNotificationsSummary());
    backend
      .expectOne('/api/teacher/schedule/summary')
      .flush(null, { status: 500, statusText: 'Error' });
    fixture.detectChanges();
    backend.expectOne('/api/me/notifications?page=0&size=5&read=false').flush(notificationPage([]));
    await fixture.whenStable();

    const text = readableText(hostElement(fixture));
    expect(text).toContain('Не удалось загрузить занятия, задания, уведомления и финансы');
    expect(text).not.toContain('Требует внимания');
  });

  it('reloads the day after a lesson was marked', async () => {
    fixture.detectChanges();
    backend.expectOne('/api/teacher/schedule/summary').flush(scheduleSummary({ unmarked: 1 }));
    backend.expectOne('/api/teacher/homework/summary').flush(homeworkSummary());
    backend.expectOne('/api/teacher/billing/summary').flush(billingSummary());
    backend.expectOne('/api/teacher/notifications/summary').flush(teacherNotificationsSummary());
    fixture.detectChanges();
    backend.expectOne('/api/me/notifications?page=0&size=5&read=false').flush(notificationPage([]));

    fixture.componentInstance.loadSchedule();
    backend.expectOne('/api/teacher/schedule/summary').flush(scheduleSummary());
    fixture.detectChanges();
    await fixture.whenStable();

    expect(readableText(hostElement(fixture))).toContain('Срочных дел нет');
  });
});
