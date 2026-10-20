import { formatDate } from '@angular/common';
import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { buttonByText, hostElement, readableText } from '@testing/dom';
import { myTask } from '@testing/homework-fixtures';
import { testProviders } from '@testing/setup';
import { MyTask } from '../data-access/homework.models';
import { StudentTasksTab, TASKS_PAGE } from './student-tasks-tab';

const TASKS = '/api/teacher/homework/students/s-1/tasks';

describe('StudentTasksTab', () => {
  let fixture: ComponentFixture<StudentTasksTab>;
  let backend: HttpTestingController;

  async function render(tasks: MyTask[]): Promise<void> {
    TestBed.configureTestingModule({ imports: [StudentTasksTab], providers: testProviders() });
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(StudentTasksTab);
    fixture.componentRef.setInput('studentId', 's-1');
    await fixture.whenStable();
    backend.expectOne(TASKS).flush(tasks);
    await fixture.whenStable();
  }

  function rows(): string[] {
    return Array.from(hostElement(fixture).querySelectorAll('li')).map((row) => readableText(row));
  }

  function day(iso: string): string {
    return formatDate(iso, 'dd.MM.yyyy', 'en-US');
  }

  afterEach(() => {
    fixture.destroy();
    backend.verify();
  });

  it('lists every task: the open ones as on Обзор, then the accepted ones, the latest first', async () => {
    await render([
      myTask({
        taskId: 'old',
        title: 'Дроби',
        status: 'ACCEPTED',
        grade: '4',
        reviewedAt: '2026-09-05T10:00:00Z',
      }),
      myTask({ taskId: 'later', title: 'Неравенства', dueAt: '2026-10-24T15:00:00Z' }),
      myTask({
        taskId: 'new',
        title: 'Проценты',
        status: 'ACCEPTED',
        reviewedAt: '2026-10-05T10:00:00Z',
      }),
      myTask({ taskId: 'review', title: 'Квадратные уравнения', status: 'SUBMITTED' }),
      myTask({ taskId: 'none', title: 'Степени', dueAt: null, overdue: true }),
    ]);

    expect(rows()).toEqual([
      `Квадратные уравнения до ${day('2026-09-10T15:00:00Z')} На проверке`,
      `Неравенства до ${day('2026-10-24T15:00:00Z')} Выдано`,
      'Степени без срока · Просрочено Выдано',
      `Проценты проверено ${day('2026-10-05T10:00:00Z')} Принято`,
      `Дроби проверено ${day('2026-09-05T10:00:00Z')} · Оценка: 4 Принято`,
    ]);
    const link = hostElement(fixture).querySelector('a');
    expect(link?.getAttribute('href')).toBe('/teacher/homework/tasks/review');
  });

  it('shows a page of tasks and the rest on «Показать ещё»', async () => {
    await render(
      Array.from({ length: TASKS_PAGE + 3 }, (_, index) =>
        myTask({ taskId: `t-${String(index)}`, title: `Задание ${String(index)}` }),
      ),
    );
    expect(rows()).toHaveLength(TASKS_PAGE);

    buttonByText(hostElement(fixture), 'Показать ещё').click();
    await fixture.whenStable();

    expect(rows()).toHaveLength(TASKS_PAGE + 3);
    expect(hostElement(fixture).textContent).not.toContain('Показать ещё');
  });

  it('says when the student has no tasks', async () => {
    await render([]);

    expect(readableText(hostElement(fixture))).toContain('Заданий пока нет');
  });

  it('lists the tasks of every member of a group with their names', async () => {
    await render([]);
    fixture.componentRef.setInput('studentId', null);
    fixture.componentRef.setInput('members', [
      { id: 's-1', displayName: 'Вера' },
      { id: 's-2', displayName: 'Глеб' },
    ]);
    await fixture.whenStable();
    backend.expectOne(TASKS).flush([myTask({ taskId: 't-1', title: 'Дроби', dueAt: null })]);
    backend
      .expectOne('/api/teacher/homework/students/s-2/tasks')
      .flush([myTask({ taskId: 't-1', title: 'Дроби', dueAt: null })]);
    await fixture.whenStable();

    expect(rows()).toEqual(['Дроби Вера · без срока Выдано', 'Дроби Глеб · без срока Выдано']);
  });

  it('has nothing to read for a group without members', async () => {
    await render([]);
    fixture.componentRef.setInput('members', []);
    await fixture.whenStable();

    expect(rows()).toEqual([]);
    expect(readableText(hostElement(fixture))).toContain('Заданий');
  });
});
