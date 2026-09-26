import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MessageService } from 'primeng/api';
import { providePrimeNG } from 'primeng/config';
import { bodyText, buttonByText, hostElement, readableText, requireElement } from '@testing/dom';
import { calendarFeed, changeRequest, scheduleSettings, scheduledLesson } from '@testing/schedule-fixtures';
import { ChangeRequest, ScheduledLesson } from '../data-access/schedule.models';
import { MySchedulePage } from './my-schedule-page';

describe('MySchedulePage', () => {
  let fixture: ComponentFixture<MySchedulePage>;
  let backend: HttpTestingController;

  const future = (hours: number): { startsAt: string; endsAt: string } => {
    const start = new Date(Date.now() + hours * 3_600_000);
    return { startsAt: start.toISOString(), endsAt: new Date(start.getTime() + 3_600_000).toISOString() };
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [MySchedulePage],
      providers: [provideHttpClient(), provideHttpClientTesting(), providePrimeNG(), MessageService],
    });
    backend = TestBed.inject(HttpTestingController);
    vi.spyOn(TestBed.inject(MessageService), 'add');
    fixture = TestBed.createComponent(MySchedulePage);
  });

  afterEach(() => {
    backend.verify();
    fixture.destroy();
  });

  function lessonRequests(): TestRequest[] {
    return backend.match((request) => request.url === '/api/me/schedule/lessons');
  }

  async function render(lessons: ScheduledLesson[], requests: ChangeRequest[] = []): Promise<string> {
    fixture.detectChanges();
    backend.expectOne('/api/me/schedule/settings').flush(scheduleSettings());
    backend.expectOne('/api/me/schedule/requests').flush(requests);
    backend.expectOne('/api/me/schedule/feed').flush(calendarFeed());
    await fixture.whenStable();
    for (const request of lessonRequests()) {
      request.flush(lessons);
    }
    await fixture.whenStable();
    return readableText(hostElement(fixture));
  }

  it('lists upcoming lessons with the link to the online lesson', async () => {
    const text = await render([
      scheduledLesson({ ...future(24), topic: 'Дроби', meetingUrl: 'https://zoom.us/j/1' }),
      scheduledLesson({ id: 'l-2', ...future(48), status: 'CANCELLED' }),
      scheduledLesson({ id: 'l-0', ...future(-5) }),
    ]);

    expect(text).toContain('Ближайшие занятия');
    expect(text).toContain('Дроби');
    expect(text).toContain('Подключиться');
    expect(text).toContain('Отменено');
    expect(requireElement(hostElement(fixture), 'a[href="https://zoom.us/j/1"]', HTMLAnchorElement)).toBeTruthy();
    expect(hostElement(fixture).querySelectorAll('.tb-schedule-list > li').length).toBe(2);
  });

  it('says when there are no lessons', async () => {
    expect(await render([])).toContain('Запланированных занятий пока нет');
  });

  it('asks the teacher to move a lesson', async () => {
    await render([scheduledLesson({ ...future(72) })]);

    buttonByText(hostElement(fixture), 'Перенести').click();
    await fixture.whenStable();
    expect(bodyText()).toContain('Перенести занятие');

    fixture.componentInstance.onSent();
    expect(TestBed.inject(MessageService).add).toHaveBeenCalled();
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
      [scheduledLesson({ ...future(24), pendingRequest: pending })],
      [pending, changeRequest({ id: 'r-2', status: 'DECLINED', answer: 'Проведём' })],
    );

    expect(text).toContain('Запрос «Отмена» ждёт ответа учителя');
    expect(text).toContain('Мои запросы');
    expect(text).toContain('Отклонено');
    expect(text).toContain('Учитель: Проведём');
    expect(() => buttonByText(hostElement(fixture), 'Перенести')).toThrow();

    buttonByText(hostElement(fixture), 'Отозвать').click();
    backend.expectOne({ method: 'DELETE', url: '/api/me/schedule/requests/r-1' }).flush(null);
    backend.expectOne('/api/me/schedule/requests').flush([]);
    for (const request of lessonRequests()) {
      request.flush([]);
    }
  });
});
