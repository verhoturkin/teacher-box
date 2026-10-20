import { formatDate } from '@angular/common';
import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { hostElement, readableText } from '@testing/dom';
import { myTask } from '@testing/homework-fixtures';
import { testProviders } from '@testing/setup';
import { MyTask } from '../data-access/homework.models';
import { StudentTasksCard } from './student-tasks-card';

describe('StudentTasksCard', () => {
  let fixture: ComponentFixture<StudentTasksCard>;
  let backend: HttpTestingController;

  async function render(tasks: MyTask[]): Promise<void> {
    TestBed.configureTestingModule({ imports: [StudentTasksCard], providers: testProviders() });
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(StudentTasksCard);
    fixture.componentRef.setInput('studentId', 's-1');
    await fixture.whenStable();
    backend.expectOne('/api/teacher/homework/students/s-1/tasks').flush(tasks);
    await fixture.whenStable();
  }

  function rows(): string[] {
    return Array.from(hostElement(fixture).querySelectorAll('li')).map((row) => readableText(row));
  }

  afterEach(() => {
    fixture.destroy();
    backend.verify();
  });

  it('lists the open tasks: works to review first, then by the deadline', async () => {
    await render([
      myTask({ taskId: 'later', title: 'Неравенства', dueAt: '2026-10-24T15:00:00Z' }),
      myTask({ taskId: 'none', title: 'Проценты', dueAt: null, status: 'RETURNED' }),
      myTask({ taskId: 'done', title: 'Принятое', status: 'ACCEPTED' }),
      myTask({ taskId: 'review', title: 'Квадратные уравнения', status: 'SUBMITTED' }),
      myTask({
        taskId: 'soon',
        title: 'Дроби',
        dueAt: '2026-10-20T15:00:00Z',
        overdue: true,
      }),
    ]);

    const date = (iso: string): string => formatDate(iso, 'dd.MM.yyyy', 'en-US');
    expect(rows()).toEqual([
      `Квадратные уравнения до ${date('2026-09-10T15:00:00Z')} На проверке`,
      `Дроби до ${date('2026-10-20T15:00:00Z')} · Просрочено Выдано`,
      `Неравенства до ${date('2026-10-24T15:00:00Z')} Выдано`,
      'Проценты без срока На доработке',
    ]);
    expect(hostElement(fixture).querySelector('a')?.getAttribute('href')).toBe(
      '/teacher/homework/tasks/review',
    );
  });

  it('shows five and counts the rest', async () => {
    await render(
      [1, 2, 3, 4, 5, 6, 7].map((day) =>
        myTask({ taskId: `t-${String(day)}`, dueAt: `2026-10-0${String(day)}T10:00:00Z` }),
      ),
    );

    expect(rows()).toHaveLength(5);
    expect(readableText(hostElement(fixture))).toContain('Ещё открытых: 2');
  });

  it('says when nothing is open', async () => {
    await render([myTask({ status: 'ACCEPTED' })]);

    expect(readableText(hostElement(fixture))).toContain('Открытых заданий нет');
  });
});
