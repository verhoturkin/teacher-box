import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { SKIP_ERROR_TOAST } from '@core/http/api-error.interceptor';
import { AdminApi } from './admin-api';

describe('AdminApi', () => {
  let api: AdminApi;
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    api = TestBed.inject(AdminApi);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    backend.verify();
  });

  it('searches the log with the filled filters only', () => {
    api.logs({ from: '2026-09-26T00:00:00Z', level: 'WARN', logger: ' ', text: ' boom ', requestId: null, limit: 50 })
      .subscribe();

    const request = backend.expectOne((candidate) => candidate.url === '/api/admin/logs');
    expect(request.request.params.keys().sort()).toEqual(['from', 'level', 'limit', 'text']);
    expect(request.request.params.get('text')).toBe('boom');
    expect(request.request.params.get('limit')).toBe('50');
  });

  it('changes and reverts log levels', () => {
    api.loggers().subscribe();
    api.changeLevel('ru.teacherbox', 'DEBUG', 30).subscribe();
    api.revertLevel('ru.teacherbox').subscribe();

    backend.expectOne({ method: 'GET', url: '/api/admin/loggers' });
    const change = backend.expectOne({ method: 'PUT', url: '/api/admin/loggers/ru.teacherbox' });
    expect(change.request.body).toEqual({ level: 'DEBUG', minutes: 30 });
    backend.expectOne({ method: 'DELETE', url: '/api/admin/loggers/ru.teacherbox' });
  });

  it('calls the state, events, deliveries, integrations, AI and diagnostics endpoints', () => {
    let resubmitted = 0;
    let retried = 0;
    api.status().subscribe();
    api.events().subscribe();
    api.resubmitEvents(['e-1']).subscribe((count) => (resubmitted = count));
    api.failedDeliveries().subscribe();
    api.retryDeliveries([]).subscribe((count) => (retried = count));
    api.checkIntegrations().subscribe();
    api.aiStatus().subscribe();
    api.aiUsage().subscribe();
    api.diagnostics().subscribe();

    backend.expectOne({ method: 'GET', url: '/api/admin/status' });
    backend.expectOne({ method: 'GET', url: '/api/admin/events' });
    const resubmit = backend.expectOne({ method: 'POST', url: '/api/admin/events/resubmit' });
    expect(resubmit.request.body).toEqual({ ids: ['e-1'] });
    resubmit.flush({ resubmitted: 1 });
    backend.expectOne({ method: 'GET', url: '/api/admin/notifications/deliveries' });
    backend.expectOne({ method: 'POST', url: '/api/admin/notifications/deliveries/retry' }).flush({ retried: 4 });
    const check = backend.expectOne({ method: 'POST', url: '/api/admin/integrations/check' });
    expect(check.request.context.get(SKIP_ERROR_TOAST)).toBe(true);
    backend.expectOne({ method: 'GET', url: '/api/admin/ai/status' });
    backend.expectOne({ method: 'GET', url: '/api/admin/ai/usage' });
    expect(backend.expectOne('/api/admin/diagnostics').request.responseType).toBe('blob');
    expect(resubmitted).toBe(1);
    expect(retried).toBe(4);
  });
});
