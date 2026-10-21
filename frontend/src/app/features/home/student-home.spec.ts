import { HttpTestingController, TestRequest } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AuthService } from '@core/auth/auth.service';
import { hostElement, readableText } from '@testing/dom';
import { aMyBoard } from '@testing/boards-fixtures';
import { myBillingSummary } from '@testing/billing-fixtures';
import { myHomeworkSummary, myTask } from '@testing/homework-fixtures';
import { channel } from '@testing/notification-fixtures';
import {
  at,
  myScheduleSummary,
  scheduleSettings,
  scheduledLesson,
} from '@testing/schedule-fixtures';
import { screenWidth, testProviders } from '@testing/setup';
import { aMyTextbook } from '@testing/textbooks-fixtures';
import { StudentHome } from './student-home';

describe('StudentHome', () => {
  let fixture: ComponentFixture<StudentHome>;
  let backend: HttpTestingController;

  function render(width = 1920): void {
    // before the lessons of the fixtures: the nearest lesson is not over
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
    vi.setSystemTime(new Date(at(2026, 10, 1, 12)));
    TestBed.configureTestingModule({
      imports: [StudentHome],
      providers: [
        ...testProviders(screenWidth(width)),
        { provide: AuthService, useValue: { user: signal({ displayName: 'Анна Смирнова' }) } },
      ],
    });
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(StudentHome);
    fixture.detectChanges();
  }

  /** The boards are asked by the feed and by the chips of the lesson. */
  function flushMaterials(boards: unknown[], textbooks: unknown[]): void {
    backend.match('/api/me/schedule/settings').forEach((request: TestRequest) => {
      request.flush(scheduleSettings());
    });
    backend.match('/api/me/boards').forEach((request: TestRequest) => {
      request.flush(boards);
    });
    backend.expectOne('/api/me/textbooks').flush(textbooks);
  }

  afterEach(() => {
    // the covers are asked once the cards are drawn
    backend
      .match((request) => request.url.endsWith('/cover'))
      .forEach((request) => {
        request.flush(new Blob());
      });
    fixture.destroy();
    backend.verify();
    localStorage.clear();
    vi.useRealTimers();
  });

  it('collects the feed: the lesson, homework, the paid lessons and the materials', async () => {
    render();
    backend.expectOne('/api/me/channels').flush([channel()]);
    backend
      .expectOne('/api/me/schedule/summary')
      .flush(myScheduleSummary({ next: scheduledLesson({ topic: 'Дроби' }) }));
    backend.expectOne('/api/me/homework/summary').flush(
      myHomeworkSummary({
        open: 2,
        upcoming: [
          myTask({ title: 'Неравенства' }),
          myTask({ taskId: 't-2', title: 'Уравнения', status: 'RETURNED' }),
        ],
      }),
    );
    backend.expectOne('/api/me/billing/summary').flush(myBillingSummary({ balance: 450_000 }));
    fixture.detectChanges();
    backend.expectOne('/api/me/homework').flush([
      myTask({
        taskId: 't-9',
        title: 'Проценты',
        status: 'ACCEPTED',
        grade: '5',
        reviewedAt: '2026-09-20T10:00:00Z',
      }),
    ]);
    flushMaterials(
      [aMyBoard({ title: 'Доска по алгебре' })],
      [aMyTextbook({ title: 'Алгебра 9' })],
    );
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const host = hostElement(fixture);
    const text = readableText(host);
    expect(text).toContain('Привет, Анна');
    expect(text).toContain('Следующее занятие:');
    expect(text).toContain('Заданий к сдаче: 2');
    expect(text).toContain('Дроби');
    expect(text).toContain('Сдать');
    expect(text).toContain('Неравенства');
    expect(text).toContain('Проверено недавно');
    expect(text).toContain('Проценты');
    expect(text).toContain('Принято · 5');
    expect(text).toContain('3 занятия');
    expect(text).toContain('Материалы урока');
    expect(text).toContain('Доска по алгебре');
    expect(text).toContain('Алгебра 9');
    // two columns: the lesson and homework first, the payments and the materials on the right
    expect(host.querySelector('.tb-feed--2')).not.toBeNull();
    expect(
      Array.from(host.querySelectorAll('.tb-feed__lead > *'), (el) => el.tagName.toLowerCase()),
    ).toEqual([
      'tb-next-lesson-widget',
      'tb-my-deadlines-widget',
      'tb-student-welcome-card',
      'tb-connect-messenger-card',
    ]);
    expect(host.querySelector('.tb-feed__side tb-my-balance-widget')).not.toBeNull();

    fixture.componentInstance.loadSchedule();
    backend.expectOne('/api/me/schedule/summary').flush(myScheduleSummary());
    fixture.detectChanges();
    await fixture.whenStable();
    expect(readableText(host)).toContain('Ближайших занятий нет');
  });

  it('is one column on a phone and hides the materials when there are none', async () => {
    render(390);
    backend.expectOne('/api/me/channels').flush([channel()]);
    backend.expectOne('/api/me/schedule/summary').flush(myScheduleSummary());
    backend.expectOne('/api/me/homework/summary').flush(myHomeworkSummary());
    backend.expectOne('/api/me/billing/summary').flush(myBillingSummary({ balance: 0 }));
    fixture.detectChanges();
    backend.expectOne('/api/me/homework').flush([]);
    flushMaterials([], []);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const host = hostElement(fixture);
    expect(host.querySelector('.tb-feed--2')).toBeNull();
    expect(host.querySelector<HTMLElement>('.tb-feed__materials')?.hidden).toBe(true);
    expect(readableText(host)).toContain('Открытых заданий нет');
  });

  it('shows a failed load with «Повторить» in the place of the feed', async () => {
    render();
    backend.expectOne('/api/me/channels').flush([channel()]);
    backend.expectOne('/api/me/homework/summary').flush(myHomeworkSummary());
    backend.expectOne('/api/me/billing/summary').flush(myBillingSummary());
    backend
      .expectOne('/api/me/schedule/summary')
      .flush(null, { status: 503, statusText: 'Unavailable' });
    fixture.detectChanges();
    flushMaterials([], []);
    await fixture.whenStable();

    expect(readableText(hostElement(fixture))).toContain(
      'Не удалось загрузить занятия, задания и баланс',
    );
    expect(hostElement(fixture).querySelector('tb-next-lesson-widget')).toBeNull();
  });
});
