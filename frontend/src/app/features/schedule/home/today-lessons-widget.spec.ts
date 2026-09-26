import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { providePrimeNG } from 'primeng/config';
import { buttonByText, hostElement, readableText } from '@testing/dom';
import { at, scheduleSummary, scheduledLesson } from '@testing/schedule-fixtures';
import { ScheduleSummary } from '../data-access/schedule.models';
import { TodayLessonsWidget } from './today-lessons-widget';

describe('TodayLessonsWidget', () => {
  let fixture: ComponentFixture<TodayLessonsWidget>;
  let backend: HttpTestingController;
  let changes: number;

  async function render(summary: ScheduleSummary): Promise<void> {
    TestBed.configureTestingModule({
      imports: [TodayLessonsWidget],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(), providePrimeNG()],
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
          scheduledLesson({ topic: 'Дроби', meetingUrl: 'https://meet.example.com/1' }),
          scheduledLesson({
            id: 'l-2',
            studentName: 'Мария',
            startsAt: at(2026, 10, 1, 20),
            endsAt: at(2026, 10, 1, 21),
          }),
          scheduledLesson({ id: 'l-3', studentName: null, status: 'CANCELLED' }),
          scheduledLesson({ id: 'l-4', studentName: 'Олег', status: 'CONDUCTED' }),
        ],
      }),
    );

    const text = readableText(hostElement(fixture));
    expect(text).toContain('18:00–19:00 Иван Петров Дроби Урок');
    expect(text).toContain('20:00–21:00 Мария');
    expect(text).toContain('Ученик Отменено');
    expect(text).toContain('Олег Проведено');
    const join = hostElement(fixture).querySelector('a.tb-today__join');
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
});
