import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { buttonByText, hostElement, readableText } from '@testing/dom';
import { reviewQueueItem } from '@testing/homework-fixtures';
import { changeRequest, groupLesson, scheduledLesson } from '@testing/schedule-fixtures';
import { testProviders } from '@testing/setup';
import { CHECKLIST_DISMISSED_KEY, SetupProgress, TodoQueue } from './todo-queue';

describe('TodoQueue', () => {
  let fixture: ComponentFixture<TodoQueue>;
  let backend: HttpTestingController;

  const done: SetupProgress = {
    hasStudents: true,
    priceSet: true,
    messengerConfigured: true,
    hasLessons: true,
  };

  async function render(
    progress: SetupProgress,
    sources: {
      lessons?: unknown[];
      requests?: unknown[];
      reviews?: unknown[];
    } = {},
    debtors: { studentId: string; displayName: string; avatar: null; balance: number }[] = [],
  ): Promise<void> {
    TestBed.configureTestingModule({ imports: [TodoQueue], providers: testProviders() });
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(TodoQueue);
    fixture.componentRef.setInput('progress', progress);
    fixture.componentRef.setInput('debtors', debtors);
    fixture.detectChanges();
    backend.expectOne('/api/teacher/schedule/unmarked').flush(sources.lessons ?? []);
    backend.expectOne('/api/teacher/schedule/requests').flush(sources.requests ?? []);
    backend.expectOne('/api/teacher/homework/review-queue').flush(sources.reviews ?? []);
    fixture.detectChanges();
    await fixture.whenStable();
  }

  function text(): string {
    return readableText(hostElement(fixture));
  }

  afterEach(() => {
    fixture.destroy();
    backend.verify();
    localStorage.clear();
  });

  it('says when nothing is waiting', async () => {
    await render(done);

    expect(text()).toContain('Срочных дел нет');
  });

  it('lists every source with its action', async () => {
    await render(
      done,
      {
        lessons: [scheduledLesson(), groupLesson()],
        requests: [changeRequest({ studentName: 'Мария' })],
        reviews: [reviewQueueItem({ title: 'Дроби', studentName: 'Анна' })],
      },
      [{ studentId: 's-9', displayName: 'Пётр', avatar: null, balance: -150_000 }],
    );

    const content = text();
    expect(content).toContain('Иван Петров');
    expect(content).toContain('Группа «ОГЭ»');
    expect(content).toContain('Мария');
    expect(content).toContain('Проверить: Дроби');
    expect(content).toContain('Пётр');
    expect(content).toContain('Долг');
    const host = hostElement(fixture);
    expect(buttonByText(host, 'Проведено')).toBeTruthy();
    const links = Array.from(host.querySelectorAll('a'), (a) => a.getAttribute('href'));
    expect(links).toEqual([
      '/teacher/schedule',
      '/teacher/schedule',
      '/teacher/homework/review',
      '/teacher/students/s-9?tab=payments',
    ]);
    expect(content).not.toContain('Срочных дел нет');
  });

  it('marks a lesson in place and tells the page', async () => {
    await render(done, { lessons: [scheduledLesson({ id: 'l-7' })] });
    const marked = vi.fn();
    fixture.componentInstance.marked.subscribe(marked);

    buttonByText(hostElement(fixture), 'Пропуск').click();
    const request = backend.expectOne('/api/teacher/schedule/lessons/l-7/outcome');
    expect(request.request.body).toEqual({ outcome: 'MISSED' });
    request.flush(scheduledLesson({ id: 'l-7', status: 'MISSED' }));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(marked).toHaveBeenCalledOnce();
    expect(text()).toContain('Срочных дел нет');
  });

  it('counts what does not fit', async () => {
    const lessons = Array.from({ length: 7 }, (_, index) =>
      scheduledLesson({ id: `l-${String(index)}` }),
    );
    await render(done, { lessons });

    expect(hostElement(fixture).querySelectorAll('li')).toHaveLength(5);
    expect(text()).toContain('Ещё 2');
  });

  it('shows the first-run steps left with progress, until hidden', async () => {
    await render({ ...done, messengerConfigured: false, hasLessons: false });

    const content = text();
    expect(content).toContain('С чего начать');
    expect(content).toContain('Сделано 2 из 4');
    expect(content).toContain('Подключите мессенджер');
    expect(content).toContain('Запланируйте первое занятие');
    expect(content).not.toContain('Добавьте ученика');
    expect(content).not.toContain('Срочных дел нет');

    buttonByText(hostElement(fixture), 'Скрыть').click();
    fixture.detectChanges();

    expect(text()).not.toContain('С чего начать');
    expect(localStorage.getItem(CHECKLIST_DISMISSED_KEY)).not.toBeNull();
  });

  it('keeps the steps hidden while something is unknown', async () => {
    await render({ ...done, priceSet: null, hasLessons: false });

    expect(text()).not.toContain('С чего начать');
  });
});
