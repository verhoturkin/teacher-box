import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CHILD_ID, familyScopeOf } from '@testing/family-fixtures';
import { buttonByText, hostElement, readableText } from '@testing/dom';
import {
  calendarFeed,
  changeRequest,
  scheduleSettings,
  scheduledLesson,
} from '@testing/schedule-fixtures';
import { testProviders } from '@testing/setup';
import { ScheduledLesson } from '../data-access/schedule.models';
import { MySchedulePage } from './my-schedule-page';

const BASE = `/api/guardian/students/${CHILD_ID}/schedule`;

describe('MySchedulePage in the family cabinet', () => {
  let fixture: ComponentFixture<MySchedulePage>;
  let backend: HttpTestingController;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 22, 12));
    TestBed.configureTestingModule({
      imports: [MySchedulePage],
      providers: [...testProviders(), familyScopeOf()],
    });
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(MySchedulePage);
  });

  afterEach(() => {
    backend.verify();
    fixture.destroy();
    vi.useRealTimers();
  });

  /** The page of the child with these lessons and requests. */
  async function load(lessons: ScheduledLesson[], requests = [changeRequest()]): Promise<void> {
    fixture.detectChanges();
    backend.expectOne((r) => r.url === `${BASE}/history`).flush([]);
    backend.expectOne(`${BASE}/settings`).flush(scheduleSettings());
    backend.expectOne('/api/guardian/schedule/feed').flush(calendarFeed({ enabled: false }));
    backend.expectOne(`${BASE}/requests`).flush(requests);
    await fixture.whenStable();
    for (const request of backend.match((r) => r.url === `${BASE}/lessons`)) {
      request.flush(lessons);
    }
    for (const request of backend.match((r) => r.url === `${BASE}/busy`)) {
      request.flush([]);
    }
    await fixture.whenStable();
  }

  it('reads the child’s lessons and requests without the links of the calls', async () => {
    const lesson = scheduledLesson({
      startsAt: new Date(2026, 9, 23, 15).toISOString(),
      endsAt: new Date(2026, 9, 23, 16).toISOString(),
      title: 'Дроби',
      joinUrl: 'https://zoom.us/j/1',
      pendingRequests: [changeRequest()],
    });
    await load(
      [lesson],
      [changeRequest({ guardianId: 'g-1', guardianName: 'Анна' }), changeRequest({ id: 'r-2' })],
    );

    const host = hostElement(fixture);
    const text = readableText(host);
    expect(text).toContain('Дроби');
    expect(text).toContain('Запросы');
    expect(text).not.toContain('Мои запросы');
    expect(text).toContain('Запрос родителя (Анна)');
    expect(text).toContain('Отозвать');
    expect(host.querySelector('a[href="https://zoom.us/j/1"]')).toBeNull();
    expect(text).toContain('Занятия всех ваших детей могут появляться в одном календаре');

    // the sheet of the lesson: no link of the call, the request can be withdrawn
    fixture.componentInstance.openSheet(lesson);
    await fixture.whenStable();
    expect(document.body.textContent).toContain('Дроби');
    expect(document.querySelector('a[href="https://zoom.us/j/1"]')).toBeNull();
    expect(document.body.textContent).toContain('Отозвать запрос');
  });

  it('asks to cancel a lesson on the child’s behalf and withdraws the request', async () => {
    const lesson = scheduledLesson({
      startsAt: new Date(2026, 9, 23, 15).toISOString(),
      endsAt: new Date(2026, 9, 23, 16).toISOString(),
      title: 'Дроби',
      pendingRequests: [],
    });
    await load([lesson], []);
    const host = hostElement(fixture);

    buttonByText(host, 'Отменить').click();
    await fixture.whenStable();
    expect(document.body.textContent).toContain('Отменить занятие');
    buttonByText(document.body, 'Попросить отменить').click();
    await fixture.whenStable();
    const sent = backend.expectOne(`${BASE}/lessons/${lesson.id}/requests`);
    expect(sent.request.body).toEqual({ kind: 'CANCEL', proposedStartsAt: null, comment: null });
    sent.flush(changeRequest({ kind: 'CANCEL', guardianId: 'g-1', guardianName: 'Анна' }));
    await fixture.whenStable();
    // the page reloads
    backend.expectOne(`${BASE}/settings`).flush(scheduleSettings());
    backend.expectOne(`${BASE}/requests`).flush([]);
    for (const request of backend.match((r) => r.url === `${BASE}/lessons`)) {
      request.flush([{ ...lesson, pendingRequests: [changeRequest({ id: 'r-9' })] }]);
    }
    for (const request of backend.match((r) => r.url === `${BASE}/busy`)) {
      request.flush([]);
    }
    await fixture.whenStable();

    buttonByText(host, 'Отозвать').click();
    backend.expectOne((r) => r.url === `${BASE}/requests/r-9` && r.method === 'DELETE').flush(null);
    await fixture.whenStable();
    backend.match(`${BASE}/settings`).forEach((request) => {
      request.flush(scheduleSettings());
    });
    backend.match(`${BASE}/requests`).forEach((request) => {
      request.flush([]);
    });
    for (const request of backend.match((r) => r.url === `${BASE}/lessons`)) {
      request.flush([lesson]);
    }
    for (const request of backend.match((r) => r.url === `${BASE}/busy`)) {
      request.flush([]);
    }
  });

  it('says the child will not come to a group lesson', async () => {
    const lesson = scheduledLesson({
      startsAt: new Date(2026, 9, 23, 15).toISOString(),
      endsAt: new Date(2026, 9, 23, 16).toISOString(),
      groupId: 'g-1',
      groupName: 'ОГЭ',
      pendingRequests: [],
    });
    await load([lesson], []);

    buttonByText(hostElement(fixture), 'Не придёт').click();
    await fixture.whenStable();
    const text = document.body.textContent;
    expect(text).toContain('Не придёт на занятие');
    expect(text).toContain('пройдёт без ребёнка');
  });
});
