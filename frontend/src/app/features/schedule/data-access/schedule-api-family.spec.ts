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
});
