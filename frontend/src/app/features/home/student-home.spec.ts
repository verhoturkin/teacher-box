import { HttpTestingController, TestRequest } from '@angular/common/http/testing';
import { Provider, signal } from '@angular/core';
import { Family } from '@core/family/family';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AuthService } from '@core/auth/auth.service';
import { buttonByText, hostElement, readableText } from '@testing/dom';
import { familyScopeOf } from '@testing/family-fixtures';
import { myBillingSummary } from '@testing/billing-fixtures';
import { myHomeworkSummary, myTask } from '@testing/homework-fixtures';
import { channel } from '@testing/notification-fixtures';
import {
  at,
  myScheduleSummary,
  scheduleSettings,
  scheduledLesson,
  dropFreeTimes,
} from '@testing/schedule-fixtures';
import { screenWidth, testProviders } from '@testing/setup';
import { StudentHome } from './student-home';

describe('StudentHome', () => {
  let fixture: ComponentFixture<StudentHome>;
  let backend: HttpTestingController;

  function render(width = 1920, providers: Provider[] = []): void {
    // before the lessons of the fixtures: the nearest lesson is not over
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
    vi.setSystemTime(new Date(at(2026, 10, 1, 12)));
    TestBed.configureTestingModule({
      imports: [StudentHome],
      providers: [
        ...testProviders(screenWidth(width)),
        { provide: AuthService, useValue: { user: signal({ displayName: 'Анна Смирнова' }) } },
        ...providers,
      ],
    });
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(StudentHome);
    fixture.detectChanges();
  }

  /** The boards are asked by the chips of the lesson. */
  function flushMaterials(): void {
    backend.match('/api/me/schedule/settings').forEach((request: TestRequest) => {
      request.flush(scheduleSettings());
    });
    backend.match('/api/me/boards').forEach((request: TestRequest) => {
      request.flush([]);
    });
  }

  afterEach(() => {
    fixture.destroy();
    dropFreeTimes(backend);
    backend.verify();
    localStorage.clear();
    vi.useRealTimers();
  });

  it('collects the feed: the lesson, homework, the paid lessons, no materials', async () => {
    render();
    backend.expectOne('/api/me/channels').flush([channel()]);
    backend
      .expectOne('/api/me/schedule/summary')
      .flush(myScheduleSummary({ next: scheduledLesson({ title: 'Дроби' }) }));
    backend.expectOne('/api/me/homework/summary').flush(
      myHomeworkSummary({
        open: 2,
        upcoming: [
          myTask({ title: 'Неравенства' }),
          myTask({ taskId: 't-2', title: 'Уравнения', status: 'RETURNED' }),
        ],
      }),
    );
    backend.expectOne('/api/me/billing/visible').flush({ visible: true });
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
    flushMaterials();
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
    expect(text).not.toContain('Материалы урока');
    // two columns: the lesson and homework first, the payments on the right
    expect(host.querySelector('.tb-feed--2')).not.toBeNull();
    expect(
      Array.from(host.querySelectorAll('.tb-feed__lead > *'), (el) => el.tagName.toLowerCase()),
    ).toEqual([
      'tb-next-lesson-widget',
      'tb-my-deadlines-widget',
      'tb-student-welcome-card',
      'tb-connect-messenger-card',
      'tb-push-onboarding-card',
    ]);
    expect(host.querySelector('.tb-feed__side tb-my-balance-widget')).not.toBeNull();

    fixture.componentInstance.loadSchedule();
    backend.expectOne('/api/me/schedule/summary').flush(myScheduleSummary());
    fixture.detectChanges();
    await fixture.whenStable();
    expect(readableText(host)).toContain('Ближайших занятий нет');
  });

  it('is one column on a phone', async () => {
    render(390);
    backend.expectOne('/api/me/channels').flush([channel()]);
    backend
      .expectOne('/api/me/schedule/summary')
      .flush(myScheduleSummary({ next: scheduledLesson() }));
    backend.expectOne('/api/me/homework/summary').flush(myHomeworkSummary());
    backend.expectOne('/api/me/billing/visible').flush({ visible: true });
    backend.expectOne('/api/me/billing/summary').flush(myBillingSummary({ balance: 0 }));
    fixture.detectChanges();
    backend.expectOne('/api/me/homework').flush([]);
    flushMaterials();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const host = hostElement(fixture);
    expect(host.querySelector('.tb-feed--2')).toBeNull();
    expect(host.querySelector('tb-page-header [meta]')).toBeNull();
    expect(readableText(host)).toContain('Открытых заданий нет');
  });

  it('shows a failed load with «Повторить» in the place of the feed', async () => {
    render();
    backend.expectOne('/api/me/channels').flush([channel()]);
    backend.expectOne('/api/me/homework/summary').flush(myHomeworkSummary());
    backend.expectOne('/api/me/billing/visible').flush({ visible: true });
    backend.expectOne('/api/me/billing/summary').flush(myBillingSummary());
    backend
      .expectOne('/api/me/schedule/summary')
      .flush(null, { status: 503, statusText: 'Unavailable' });
    fixture.detectChanges();
    flushMaterials();
    await fixture.whenStable();

    expect(readableText(hostElement(fixture))).toContain(
      'Не удалось загрузить занятия, задания и баланс',
    );
    expect(hostElement(fixture).querySelector('tb-next-lesson-widget')).toBeNull();
  });

  it('leaves the balance out when the teacher hid the payments from the student (452.3)', async () => {
    render();
    backend.expectOne('/api/me/channels').flush([channel()]);
    backend.expectOne('/api/me/schedule/summary').flush(myScheduleSummary());
    backend.expectOne('/api/me/homework/summary').flush(myHomeworkSummary());
    backend.expectOne('/api/me/billing/visible').flush({ visible: false });
    backend.expectNone('/api/me/billing/summary');
    fixture.detectChanges();
    backend.expectOne('/api/me/homework').flush([]);
    flushMaterials();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const host = hostElement(fixture);
    expect(host.querySelector('tb-my-balance-widget')).toBeNull();
    expect(host.querySelector('tb-student-welcome-card a[href="/cabinet/billing"]')).toBeNull();
    expect(
      host.querySelector('tb-student-welcome-card a[href="/cabinet/homework"]'),
    ).not.toBeNull();
  });

  it('shows a child in the family cabinet: their name, their data, the parent’s hints', async () => {
    render(1920, [
      familyScopeOf('s-1'),
      { provide: Family, useValue: { child: signal({ displayName: 'Петя Смирнов' }) } },
    ]);
    // the parent's own messengers (454.3)
    backend.expectOne('/api/me/channels').flush([channel()]);
    backend
      .expectOne('/api/guardian/students/s-1/schedule/summary')
      .flush(myScheduleSummary({ next: scheduledLesson({ title: 'Дроби' }) }));
    backend
      .expectOne('/api/guardian/students/s-1/homework/summary')
      .flush(myHomeworkSummary({ open: 1, upcoming: [myTask({ title: 'Неравенства' })] }));
    backend
      .expectOne('/api/guardian/students/s-1/billing/summary')
      .flush(myBillingSummary({ balance: 450_000 }));
    backend.expectNone('/api/me/billing/visible');
    fixture.detectChanges();
    backend.expectOne('/api/guardian/students/s-1/homework').flush([]);
    backend.match('/api/guardian/students/s-1/schedule/settings').forEach((request) => {
      request.flush(scheduleSettings());
    });
    backend.expectNone('/api/me/boards');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const host = hostElement(fixture);
    const text = readableText(host);
    expect(host.querySelector('h1')?.textContent).toContain('Петя Смирнов');
    expect(text).not.toContain('Привет');
    expect(text).toContain('Дроби');
    expect(text).toContain('Неравенства');
    expect(host.querySelector('tb-my-balance-widget a')?.getAttribute('href')).toBe(
      '/family/s-1/billing',
    );
    expect(host.querySelector('tb-my-deadlines-widget')).not.toBeNull();
    expect(host.querySelector('tb-student-welcome-card')).toBeNull();
    const connect = host.querySelector('tb-connect-messenger-card');
    expect(connect?.textContent).toContain('о занятиях ребёнка');
    expect(connect?.querySelector('a')?.getAttribute('href')).toBe('/family/s-1/account');
    // the parent asks to move or cancel the child's lesson, but does not join it
    expect(buttonByText(host, 'Перенести')).not.toBeNull();
    expect(host.querySelector('tb-join-lesson-button')).toBeNull();
  });
});
