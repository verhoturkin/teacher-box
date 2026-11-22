import { formatDate } from '@angular/common';
import { HttpTestingController, TestRequest } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { hostElement, readableText } from '@testing/dom';
import { periodTask, tasksReport } from '@testing/homework-fixtures';
import { testProviders } from '@testing/setup';
import { PeriodTasksCard } from './period-tasks-card';

describe('PeriodTasksCard', () => {
  let fixture: ComponentFixture<PeriodTasksCard>;
  let backend: HttpTestingController;

  async function render(): Promise<void> {
    TestBed.configureTestingModule({ imports: [PeriodTasksCard], providers: testProviders() });
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(PeriodTasksCard);
    fixture.componentRef.setInput('studentId', 's-1');
    fixture.componentRef.setInput('from', '2026-10-01');
    fixture.componentRef.setInput('to', '2026-10-31');
    await fixture.whenStable();
  }

  function request(): TestRequest {
    return backend.expectOne((req) => req.url === '/api/teacher/homework/students/s-1/report');
  }

  function text(): string {
    return readableText(hostElement(fixture));
  }

  const day = (iso: string): string => formatDate(iso, 'dd.MM', 'en-US');

  afterEach(() => {
    fixture.destroy();
    backend.verify();
  });

  it('shows the figures and every task with its deadline, lateness and grade', async () => {
    await render();
    request().flush(
      tasksReport({
        assigned: 3,
        submitted: 2,
        onTime: 1,
        late: 1,
        accepted: 1,
        returned: 1,
        tasks: [
          periodTask({ taskId: 'a' }),
          periodTask({
            taskId: 'b',
            title: 'Проценты',
            status: 'RETURNED',
            submittedAt: '2026-10-09T12:00:00Z',
            grade: null,
          }),
          periodTask({
            taskId: 'c',
            title: 'Уравнения',
            status: 'ASSIGNED',
            dueAt: null,
            submittedAt: null,
            grade: null,
          }),
        ],
      }),
    );
    await fixture.whenStable();

    expect(text()).toContain('Выдано 3');
    expect(text()).toContain('Сдано 2 в срок: 1 · с опозданием: 1');
    expect(text()).toContain('Принято 1');
    expect(text()).toContain('На доработке 1');
    const rows = Array.from(hostElement(fixture).querySelectorAll('li')).map((row) =>
      readableText(row),
    );
    const given = `выдано ${day('2026-10-05T16:00:00Z')}`;
    const due = `срок ${day('2026-10-08T15:00:00Z')}`;
    expect(rows).toEqual([
      `Дроби ${given} · ${due} · Оценка: 5 Принято`,
      `Проценты ${given} · ${due} · сдано с опозданием На доработке`,
      `Уравнения ${given} · без срока Выдано`,
    ]);
    expect(hostElement(fixture).querySelector('a')?.getAttribute('href')).toBe(
      '/teacher/homework/tasks/a',
    );
  });

  it('says when no homework was set and hides the split of none handed in', async () => {
    await render();
    request().flush(tasksReport({ assigned: 0, submitted: 0, onTime: 0, accepted: 0, tasks: [] }));
    await fixture.whenStable();

    expect(text()).toContain('За этот период заданий не выдавали');
    expect(text()).not.toContain('в срок');

    fixture.componentRef.setInput('from', '2026-09-01');
    await fixture.whenStable();
    const again = request();
    expect(again.request.params.get('from')).toBe('2026-09-01');
    again.flush(tasksReport());
  });
});
