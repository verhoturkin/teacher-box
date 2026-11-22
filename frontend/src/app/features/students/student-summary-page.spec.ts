import { HttpTestingController, TestRequest } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { toIsoDate } from '@shared/dates/iso-date';
import { aiProvider, aiStatus } from '@testing/ai-fixtures';
import { buttonByText, readableText } from '@testing/dom';
import { tasksReport } from '@testing/homework-fixtures';
import { aStudent } from '@testing/identity-fixtures';
import { lessonsReport } from '@testing/schedule-fixtures';
import { testProvidersWithRouter } from '@testing/setup';
import {
  StudentSummaryPage,
  lastFullMonth,
  periodProblem,
  plusMonths,
} from './student-summary-page';

const LESSONS = '/api/teacher/schedule/students/s-1/report';
const TASKS = '/api/teacher/homework/students/s-1/report';

describe('StudentSummaryPage', () => {
  let harness: RouterTestingHarness;
  let backend: HttpTestingController;

  async function open(url: string, ai = true): Promise<StudentSummaryPage> {
    TestBed.configureTestingModule({
      providers: testProvidersWithRouter(
        provideRouter([
          { path: 'teacher/students/:studentId/summary', component: StudentSummaryPage },
        ]),
      ),
    });
    backend = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
    const page = await harness.navigateByUrl(url, StudentSummaryPage);
    backend.expectOne('/api/teacher/ai/status').flush(aiStatus({ enabled: ai }));
    backend
      .expectOne('/api/teacher/students')
      .flush([aStudent({ id: 's-1', displayName: 'Мария' })]);
    await harness.fixture.whenStable();
    return page;
  }

  /** The two reports of the period, answered; the AI pane's own reads answered quietly. */
  async function answer(): Promise<[TestRequest, TestRequest]> {
    const lessons = backend.expectOne((request) => request.url === LESSONS);
    const tasks = backend.expectOne((request) => request.url === TASKS);
    lessons.flush(lessonsReport());
    tasks.flush(tasksReport());
    for (const request of backend.match(() => true)) {
      request.flush(request.request.url === '/api/teacher/ai/providers' ? [aiProvider()] : []);
    }
    await harness.fixture.whenStable();
    return [lessons, tasks];
  }

  function text(): string {
    return readableText(harness.routeNativeElement ?? document.body);
  }

  afterEach(() => {
    backend.verify();
    vi.restoreAllMocks();
  });

  it('shows the facts of the period of the address and the AI pane, and prints', async () => {
    await open('/teacher/students/s-1/summary?from=2026-10-01&to=2026-10-31');
    const [lessons, tasks] = await answer();

    expect(lessons.request.params.get('from')).toBe('2026-10-01');
    expect(tasks.request.params.get('to')).toBe('2026-10-31');
    expect(text()).toContain('Итоги за период');
    expect(text()).toContain('Мария');
    expect(text()).toContain('Мария: итоги с 01.10.2026 по 31.10.2026');
    expect(text()).toContain('Проведено');
    expect(text()).toContain('Выдано');
    expect(text()).toContain('Составить с ИИ');
    const back = harness.routeNativeElement?.querySelector('a[aria-label="Карточка ученика"]');
    expect(back?.getAttribute('href')).toBe('/teacher/students/s-1');

    const print = vi.spyOn(window, 'print').mockImplementation(() => undefined);
    buttonByText(harness.routeNativeElement ?? document.body, 'Печать').click();
    expect(print).toHaveBeenCalled();
  });

  it('opens on the last full month and keeps a chosen period in the address', async () => {
    const page = await open('/teacher/students/s-1/summary', false);
    const month = lastFullMonth(new Date());
    const [lessons] = await answer();
    expect(lessons.request.params.get('from')).toBe(toIsoDate(month.from));
    expect(lessons.request.params.get('to')).toBe(toIsoDate(month.to));
    expect(text()).not.toContain('Составить с ИИ');

    page.from.setValue(new Date(2026, 8, 1));
    page.to.setValue(null);
    await harness.fixture.whenStable();
    page.to.setValue(new Date(2026, 8, 30));
    await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe(
      '/teacher/students/s-1/summary?from=2026-09-01&to=2026-09-30',
    );
    // each chosen day reads the facts of the period it makes; a cleared field reads nothing
    const reads = backend.match((request) => request.url === LESSONS || request.url === TASKS);
    expect(reads.map((request) => request.request.params.get('to'))).toEqual([
      toIsoDate(month.to),
      toIsoDate(month.to),
      '2026-09-30',
      '2026-09-30',
    ]);
    for (const request of reads) {
      request.flush(request.request.url === LESSONS ? lessonsReport() : tasksReport());
    }
  });

  it('explains a period the server would refuse and reads nothing for it', async () => {
    const page = await open('/teacher/students/s-1/summary?from=2026-10-31&to=2026-10-01');

    expect(text()).toContain('Конец периода раньше его начала');
    expect(buttonByText(harness.routeNativeElement ?? document.body, 'Печать').disabled).toBe(true);
    backend.expectNone((request) => request.url === LESSONS);

    page.from.setValue(new Date(2026, 0, 1));
    page.to.setValue(new Date(2026, 6, 2));
    await harness.fixture.whenStable();
    expect(text()).toContain('Период — не длиннее 6 месяцев');
    backend.expectNone((request) => request.url === TASKS);
  });

  it('says when the student is not found', async () => {
    TestBed.configureTestingModule({
      providers: testProvidersWithRouter(
        provideRouter([
          { path: 'teacher/students/:studentId/summary', component: StudentSummaryPage },
        ]),
      ),
    });
    backend = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/teacher/students/gone/summary', StudentSummaryPage);
    backend.expectOne('/api/teacher/ai/status').flush(aiStatus());
    backend.expectOne('/api/teacher/students').flush([aStudent({ id: 's-1' })]);
    await harness.fixture.whenStable();

    expect(text()).toContain('Ученик не найден');
  });
});

describe('the period of a summary', () => {
  it('opens on the month before this one, across a new year too', () => {
    expect(lastFullMonth(new Date(2026, 10, 22))).toEqual({
      from: new Date(2026, 9, 1),
      to: new Date(2026, 9, 31),
    });
    expect(lastFullMonth(new Date(2027, 0, 5))).toEqual({
      from: new Date(2026, 11, 1),
      to: new Date(2026, 11, 31),
    });
  });

  it('adds months as the server does, keeping the day within a shorter month', () => {
    expect(plusMonths(new Date(2026, 7, 31), 6)).toEqual(new Date(2027, 1, 28));
    expect(plusMonths(new Date(2026, 0, 15), 6)).toEqual(new Date(2026, 6, 15));
  });

  it('allows at most six months and no end before the start', () => {
    const from = new Date(2026, 0, 15);
    expect(periodProblem({ from, to: from })).toBeNull();
    expect(periodProblem({ from, to: new Date(2026, 6, 15) })).toBeNull();
    expect(periodProblem({ from, to: new Date(2026, 6, 16) })).toBe('tooLong');
    expect(periodProblem({ from, to: new Date(2026, 0, 14) })).toBe('endBeforeStart');
  });
});
