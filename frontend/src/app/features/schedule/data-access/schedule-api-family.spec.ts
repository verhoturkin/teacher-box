import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { CHILD_ID, familyScopeOf } from '@testing/family-fixtures';
import { testProviders } from '@testing/setup';
import { ScheduleApi } from './schedule-api';

describe('ScheduleApi in the family cabinet', () => {
  it('reads the child’s schedule and the parent’s calendar link of all the children', () => {
    TestBed.configureTestingModule({ providers: [...testProviders(), familyScopeOf()] });
    const api = TestBed.inject(ScheduleApi);
    const backend = TestBed.inject(HttpTestingController);
    const base = `/api/guardian/students/${CHILD_ID}/schedule`;

    api.settings().subscribe();
    api.mySummary().subscribe();
    api.myLessons('2026-10-01', '2026-10-08').subscribe();
    api.myLesson('l-1').subscribe();
    api.myHistory(null, 20).subscribe();
    api.feed().subscribe();
    api.createFeed().subscribe();
    api.disableFeed().subscribe();

    backend.expectOne(`${base}/settings`);
    backend.expectOne(`${base}/summary`);
    backend.expectOne((r) => r.url === `${base}/lessons`);
    backend.expectOne(`${base}/lessons/l-1`);
    backend.expectOne((r) => r.url === `${base}/history`);
    backend.expectOne((r) => r.url === '/api/guardian/schedule/feed' && r.method === 'GET');
    backend.expectOne((r) => r.url === '/api/guardian/schedule/feed' && r.method === 'POST');
    backend.expectOne((r) => r.url === '/api/guardian/schedule/feed' && r.method === 'DELETE');
    backend.verify();
  });

  it('asks to move or cancel a lesson on the child’s behalf (454.3)', () => {
    TestBed.configureTestingModule({ providers: [...testProviders(), familyScopeOf()] });
    const api = TestBed.inject(ScheduleApi);
    const backend = TestBed.inject(HttpTestingController);
    const base = `/api/guardian/students/${CHILD_ID}/schedule`;

    api.requestChange('l-1', { kind: 'CANCEL', proposedStartsAt: null, comment: null }).subscribe();
    api.myRequests().subscribe();
    api.withdraw('r-1').subscribe();
    api.teacherBusy('2026-10-01T00:00:00Z', '2026-10-02T00:00:00Z').subscribe();
    api.freeTimes('l-1', '2026-10-01', false).subscribe();
    api.freeTimes('l-1', '2026-10-01', true).subscribe();

    backend.expectOne((r) => r.url === `${base}/lessons/l-1/requests` && r.method === 'POST');
    backend.expectOne((r) => r.url === `${base}/requests` && r.method === 'GET');
    backend.expectOne((r) => r.url === `${base}/requests/r-1` && r.method === 'DELETE');
    backend.expectOne((r) => r.url === `${base}/busy`);
    backend.expectOne((r) => r.url === `${base}/free-times`);
    backend.expectOne((r) => r.url === '/api/teacher/schedule/free-times');
    backend.verify();
  });
});
