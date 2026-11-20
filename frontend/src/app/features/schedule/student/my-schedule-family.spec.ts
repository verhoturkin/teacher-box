import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CHILD_ID, familyScopeOf } from '@testing/family-fixtures';
import { hostElement, readableText } from '@testing/dom';
import {
  calendarFeed,
  changeRequest,
  scheduleSettings,
  scheduledLesson,
} from '@testing/schedule-fixtures';
import { testProviders } from '@testing/setup';
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

  it('reads the child’s lessons without requests, busy time, links or boards', async () => {
    const lesson = scheduledLesson({
      startsAt: new Date(2026, 9, 23, 15).toISOString(),
      endsAt: new Date(2026, 9, 23, 16).toISOString(),
      title: 'Дроби',
      joinUrl: 'https://zoom.us/j/1',
      pendingRequests: [changeRequest()],
    });
    fixture.detectChanges();
    backend.expectOne((r) => r.url === `${BASE}/history`).flush([]);
    backend.expectOne(`${BASE}/settings`).flush(scheduleSettings());
    backend.expectOne('/api/guardian/schedule/feed').flush(calendarFeed({ enabled: false }));
    backend.expectNone('/api/me/schedule/requests');
    await fixture.whenStable();
    for (const request of backend.match((r) => r.url === `${BASE}/lessons`)) {
      request.flush([lesson]);
    }
    backend.expectNone('/api/me/schedule/busy');
    await fixture.whenStable();

    const host = hostElement(fixture);
    const text = readableText(host);
    expect(text).toContain('Дроби');
    expect(text).not.toContain('Перенести или отменить');
    expect(text).not.toContain('Отозвать');
    expect(host.querySelector('a[href="https://zoom.us/j/1"]')).toBeNull();
    expect(text).toContain('Занятия всех ваших детей могут появляться в одном календаре');

    // the sheet of the lesson: no link of the call, no requests either
    fixture.componentInstance.openSheet(lesson);
    await fixture.whenStable();
    expect(document.body.textContent).toContain('Дроби');
    expect(document.querySelector('a[href="https://zoom.us/j/1"]')).toBeNull();
    expect(document.body.textContent).not.toContain('Отозвать запрос');
  });
});
