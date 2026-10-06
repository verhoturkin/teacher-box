import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { bodyText, buttonByText, hostElement, readableText } from '@testing/dom';
import { at, groupLesson, scheduleSummary, scheduledLesson } from '@testing/schedule-fixtures';
import { ScheduleSummary } from '../data-access/schedule.models';
import { AttendanceDialog } from '../teacher/attendance-dialog';
import { TodayLessonsWidget } from './today-lessons-widget';
import { testProviders } from '@testing/setup';

describe('TodayLessonsWidget', () => {
  let fixture: ComponentFixture<TodayLessonsWidget>;
  let backend: HttpTestingController;
  let changes: number;

  async function render(summary: ScheduleSummary): Promise<void> {
    TestBed.configureTestingModule({
      imports: [TodayLessonsWidget],
      providers: testProviders(),
    });
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(TodayLessonsWidget);
    changes = 0;
    fixture.componentInstance.changed.subscribe(() => changes++);
    fixture.componentRef.setInput('summary', summary);
    fixture.componentRef.setInput('now', new Date(at(2026, 10, 1, 18, 30)));
    fixture.detectChanges();
    await fixture.whenStable();
  }

  afterEach(() => {
    fixture.destroy();
    backend.verify();
  });

  it('says when there are no lessons today', async () => {
    await render(scheduleSummary({ weekLessons: 4 }));

    const text = readableText(hostElement(fixture));
    expect(text).toContain('Сегодня занятий нет');
    expect(text).toContain('Впереди на неделе: 4');
    expect(hostElement(fixture).querySelector('a[href="/teacher/schedule"]')).not.toBeNull();
  });

  it('lists the lessons of the day with their state', async () => {
    await render(
      scheduleSummary({
        today: [
          scheduledLesson({ topic: 'Дроби', joinUrl: 'https://meet.example.com/1' }),
          scheduledLesson({
            id: 'l-2',
            studentName: 'Мария',
            studentAvatar: '/api/public/avatars/maria',
            startsAt: at(2026, 10, 1, 20),
            endsAt: at(2026, 10, 1, 21),
          }),
          scheduledLesson({ id: 'l-3', studentName: null, status: 'CANCELLED' }),
          scheduledLesson({ id: 'l-4', studentName: 'Олег', status: 'CONDUCTED' }),
        ],
      }),
    );

    const text = readableText(hostElement(fixture));
    expect(text).toContain('ИП Иван Петров 18:00–19:00 · Дроби Начать урок');
    expect(text).toContain('Мария 20:00–21:00');
    expect(hostElement(fixture).querySelector('tb-avatar img')?.getAttribute('src')).toBe(
      '/api/public/avatars/maria',
    );
    expect(text).toContain('Ученик 18:00–19:00 Отменено');
    expect(text).toContain('Олег 18:00–19:00 Проведено');
    const join = hostElement(fixture).querySelector('tb-join-lesson-button a');
    expect(join?.getAttribute('href')).toBe('https://meet.example.com/1');
    expect(() => buttonByText(hostElement(fixture), 'Проведено: Мария')).toThrow();
  });

  it('marks a lesson that has started', async () => {
    await render(scheduleSummary({ today: [scheduledLesson()] }));

    buttonByText(hostElement(fixture), 'Проведено: Иван Петров').click();
    const request = backend.expectOne('/api/teacher/schedule/lessons/l-1/outcome');
    expect(request.request.body).toEqual({ outcome: 'CONDUCTED' });
    request.flush(scheduledLesson({ status: 'CONDUCTED' }));

    buttonByText(hostElement(fixture), 'Пропуск: Иван Петров').click();
    backend
      .expectOne('/api/teacher/schedule/lessons/l-1/outcome')
      .flush(null, { status: 500, statusText: 'Error' });

    expect(changes).toBe(1);
  });

  it('opens the attendance of a group lesson that has started', async () => {
    await render(scheduleSummary({ today: [groupLesson()] }));

    const text = readableText(hostElement(fixture));
    expect(text).toContain('ГО Группа «ОГЭ» 18:00–19:00 · учеников: 2');
    buttonByText(hostElement(fixture), 'Отметить посещаемость: Группа «ОГЭ»').click();
    await fixture.whenStable();

    expect(bodyText()).toContain('Кто был на занятии');
    const dialog = fixture.debugElement
      .query(By.directive(AttendanceDialog))
      .injector.get(AttendanceDialog);
    dialog.saved.emit(groupLesson({ status: 'CONDUCTED' }));
    expect(changes).toBe(1);
  });
});
