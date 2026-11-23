import { HttpTestingController, TestRequest } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { hostElement, readableText } from '@testing/dom';
import { lessonsReport, periodLesson } from '@testing/schedule-fixtures';
import { testProviders } from '@testing/setup';
import { formatLessonStart } from '../schedule-labels';
import { PeriodLessonsCard } from './period-lessons-card';

describe('PeriodLessonsCard', () => {
  let fixture: ComponentFixture<PeriodLessonsCard>;
  let backend: HttpTestingController;

  async function render(): Promise<void> {
    TestBed.configureTestingModule({ imports: [PeriodLessonsCard], providers: testProviders() });
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(PeriodLessonsCard);
    fixture.componentRef.setInput('studentId', 's-1');
    fixture.componentRef.setInput('from', '2026-10-01');
    fixture.componentRef.setInput('to', '2026-10-31');
    await fixture.whenStable();
  }

  function request(): TestRequest {
    return backend.expectOne((req) => req.url === '/api/teacher/schedule/students/s-1/report');
  }

  function text(): string {
    return readableText(hostElement(fixture));
  }

  afterEach(() => {
    fixture.destroy();
    backend.verify();
  });

  it('shows the figures, the rarer outcomes and every lesson with what was covered', async () => {
    await render();
    request().flush(
      lessonsReport({
        held: 1,
        missed: 1,
        excused: 1,
        cancelledByStudent: 1,
        lateCancellations: 0,
        lessons: [
          periodLesson({ lessonId: 'a', summary: 'Сложение дробей' }),
          periodLesson({
            lessonId: 'b',
            topic: null,
            title: 'Пробный ОГЭ',
            groupId: 'g-1',
            outcome: 'EXCUSED',
          }),
          periodLesson({ lessonId: 'c', topic: null, outcome: 'MISSED' }),
          periodLesson({ lessonId: 'd', outcome: 'CANCELLED', cancelledBy: 'STUDENT' }),
          periodLesson({ lessonId: 'e', planId: 'p-1' }),
          periodLesson({ lessonId: 'f', planId: 'p-2', outcome: 'MISSED' }),
        ],
      }),
    );
    await fixture.whenStable();

    expect(text()).toContain('Проведено 1');
    expect(text()).toContain('Пропуски 1');
    expect(text()).toContain('Предупредил: 1 · Отменил ученик: 1');
    expect(text()).not.toContain('Поздние отмены');
    const rows = Array.from(hostElement(fixture).querySelectorAll('li')).map((row) =>
      readableText(row),
    );
    const start = formatLessonStart('2026-10-05T15:00:00Z');
    expect(rows).toEqual([
      `${start} Дроби Что прошли Сложение дробей Был`,
      `${start} Пробный ОГЭ Предупредил`,
      `${start} Пропуск`,
      `${start} Дроби Отменено по просьбе ученика`,
      `${start} Дроби Прошли по плану Был`,
      `${start} Дроби Пропуск`,
    ]);
    expect(hostElement(fixture).querySelector('.tb-i-group')).not.toBeNull();
  });

  it('says when the period has no lessons and reads again for another period', async () => {
    await render();
    request().flush(lessonsReport({ held: 0, lessons: [], lateCancellations: 2 }));
    await fixture.whenStable();

    expect(text()).toContain('За этот период занятий нет');
    expect(text()).toContain('Поздние отмены: 2');

    fixture.componentRef.setInput('to', '2026-11-30');
    await fixture.whenStable();
    const again = request();
    expect(again.request.params.get('to')).toBe('2026-11-30');
    again.flush(lessonsReport());
  });
});
