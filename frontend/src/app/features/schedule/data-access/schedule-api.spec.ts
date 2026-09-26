import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { SKIP_ERROR_TOAST } from '@core/http/api-error.interceptor';
import { ScheduleApi } from './schedule-api';
import { SeriesRequest } from './schedule.models';

describe('ScheduleApi', () => {
  let api: ScheduleApi;
  let backend: HttpTestingController;

  const series: SeriesRequest = {
    studentId: 's-1',
    weekdays: ['MONDAY'],
    startTime: '18:00',
    durationMinutes: 60,
    intervalWeeks: 1,
    startsOn: '2026-10-01',
    endsOn: null,
    topic: null,
    meetingUrl: null,
    allowOverlap: false,
  };

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    api = TestBed.inject(ScheduleApi);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    backend.verify();
  });

  it('calls the teacher lesson endpoints', () => {
    const details = { startsAt: '2026-10-01T15:00:00Z', durationMinutes: 60, topic: null, meetingUrl: null, allowOverlap: false };
    api.lessons('2026-09-28', '2026-10-05').subscribe();
    api.plan({ studentId: 's-1', ...details }).subscribe();
    api.edit('l-1', details).subscribe();
    api.cancel('l-1', { reason: null, byStudent: true, charge: false }).subscribe();
    api.setOutcome('l-1', 'MISSED').subscribe();
    api.reopen('l-1').subscribe();
    api.unmarked().subscribe();

    expect(backend.expectOne('/api/teacher/schedule/lessons?from=2026-09-28&to=2026-10-05').request.method).toBe('GET');
    const plan = backend.expectOne({ method: 'POST', url: '/api/teacher/schedule/lessons' });
    expect(plan.request.context.get(SKIP_ERROR_TOAST)).toBe(true);
    const edit = backend.expectOne({ method: 'PUT', url: '/api/teacher/schedule/lessons/l-1' });
    expect(edit.request.context.get(SKIP_ERROR_TOAST)).toBe(true);
    expect(backend.expectOne('/api/teacher/schedule/lessons/l-1/cancel').request.body).toEqual({
      reason: null,
      byStudent: true,
      charge: false,
    });
    expect(backend.expectOne({ method: 'PUT', url: '/api/teacher/schedule/lessons/l-1/outcome' }).request.body).toEqual({
      outcome: 'MISSED',
    });
    expect(backend.expectOne({ method: 'DELETE', url: '/api/teacher/schedule/lessons/l-1/outcome' })).toBeTruthy();
    expect(backend.expectOne('/api/teacher/schedule/unmarked').request.method).toBe('GET');
  });

  it('calls the series and request endpoints', () => {
    api.series().subscribe();
    api.planSeries(series).subscribe();
    api.changeSeries('sr-1', series).subscribe();
    api.stopSeries('sr-1', '2026-10-05').subscribe();
    api.pendingRequests().subscribe();
    api.approve('r-1', { startsAt: null, charge: true, answer: 'Ок' }).subscribe();
    api.decline('r-2', 'Нет').subscribe();

    expect(backend.expectOne({ method: 'GET', url: '/api/teacher/schedule/series' })).toBeTruthy();
    expect(backend.expectOne({ method: 'POST', url: '/api/teacher/schedule/series' }).request.body).toEqual(series);
    expect(backend.expectOne({ method: 'PUT', url: '/api/teacher/schedule/series/sr-1' })).toBeTruthy();
    expect(backend.expectOne('/api/teacher/schedule/series/sr-1/stop').request.body).toEqual({ from: '2026-10-05' });
    expect(backend.expectOne('/api/teacher/schedule/requests').request.method).toBe('GET');
    expect(backend.expectOne('/api/teacher/schedule/requests/r-1/approve').request.body).toEqual({
      startsAt: null,
      charge: true,
      answer: 'Ок',
    });
    expect(backend.expectOne('/api/teacher/schedule/requests/r-2/decline').request.body).toEqual({ answer: 'Нет' });
  });

  it('calls the personal area endpoints', () => {
    api.settings().subscribe();
    api.myLessons('2026-10-01', '2026-11-01').subscribe();
    api.requestChange('l-1', { kind: 'CANCEL', proposedStartsAt: null, comment: null }).subscribe();
    api.myRequests().subscribe();
    api.withdraw('r-1').subscribe();
    api.feed().subscribe();
    api.createFeed().subscribe();
    api.disableFeed().subscribe();

    expect(backend.expectOne('/api/me/schedule/settings').request.method).toBe('GET');
    expect(backend.expectOne('/api/me/schedule/lessons?from=2026-10-01&to=2026-11-01').request.method).toBe('GET');
    expect(backend.expectOne('/api/me/schedule/lessons/l-1/requests').request.context.get(SKIP_ERROR_TOAST)).toBe(true);
    expect(backend.expectOne({ method: 'GET', url: '/api/me/schedule/requests' })).toBeTruthy();
    expect(backend.expectOne({ method: 'DELETE', url: '/api/me/schedule/requests/r-1' })).toBeTruthy();
    expect(backend.expectOne({ method: 'GET', url: '/api/me/schedule/feed' })).toBeTruthy();
    expect(backend.expectOne({ method: 'POST', url: '/api/me/schedule/feed' })).toBeTruthy();
    expect(backend.expectOne({ method: 'DELETE', url: '/api/me/schedule/feed' })).toBeTruthy();
  });

  it('calls the Google Calendar endpoints', () => {
    api.googleStatus().subscribe();
    api.saveGoogleClient('id', 'secret').subscribe();
    api.authorizeGoogle('https://school', true).subscribe();
    api.syncGoogle().subscribe();
    api.disconnectGoogle().subscribe();
    api.googleBusy('2026-10-01T00:00:00Z', '2026-10-08T00:00:00Z').subscribe();

    expect(backend.expectOne({ method: 'GET', url: '/api/teacher/schedule/google' })).toBeTruthy();
    expect(backend.expectOne('/api/teacher/schedule/google/client').request.body).toEqual({
      clientId: 'id',
      clientSecret: 'secret',
    });
    expect(backend.expectOne('/api/teacher/schedule/google/authorize').request.body).toEqual({
      origin: 'https://school',
      busy: true,
    });
    expect(backend.expectOne('/api/teacher/schedule/google/sync').request.method).toBe('POST');
    expect(backend.expectOne({ method: 'DELETE', url: '/api/teacher/schedule/google' })).toBeTruthy();
    expect(
      backend.expectOne(
        '/api/teacher/schedule/google/busy?from=2026-10-01T00:00:00Z&to=2026-10-08T00:00:00Z',
      ).request.method,
    ).toBe('GET');
  });

  it('loads the summaries of the home pages', () => {
    api.summary().subscribe();
    api.mySummary().subscribe();

    expect(backend.expectOne('/api/teacher/schedule/summary').request.method).toBe('GET');
    expect(backend.expectOne('/api/me/schedule/summary').request.method).toBe('GET');
  });
});
