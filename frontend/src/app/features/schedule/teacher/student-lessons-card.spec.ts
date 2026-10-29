import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { buttonByText, hostElement, readableText, requireElement } from '@testing/dom';
import { groupLesson, scheduledLesson } from '@testing/schedule-fixtures';
import { testProviders } from '@testing/setup';
import { toIsoDate } from '@shared/dates/iso-date';
import { ScheduledLesson } from '../data-access/schedule.models';
import { StudentLessonsCard } from './student-lessons-card';

const HOUR = 3_600_000;

function inHours(hours: number): { startsAt: string; endsAt: string } {
  const start = Date.now() + hours * HOUR;
  return {
    startsAt: new Date(start).toISOString(),
    endsAt: new Date(start + HOUR).toISOString(),
  };
}

describe('StudentLessonsCard', () => {
  let fixture: ComponentFixture<StudentLessonsCard>;
  let backend: HttpTestingController;

  async function render(): Promise<void> {
    TestBed.configureTestingModule({ imports: [StudentLessonsCard], providers: testProviders() });
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(StudentLessonsCard);
    fixture.componentRef.setInput('of', { studentId: 's-1' });
    await fixture.whenStable();
  }

  function answer(lessons: ScheduledLesson[]): void {
    const request = backend.expectOne((r) => r.url === '/api/teacher/schedule/lessons');
    expect(request.request.params.get('studentId')).toBe('s-1');
    expect(request.request.params.get('from')).toBe(toIsoDate(new Date()));
    request.flush(lessons);
  }

  afterEach(() => {
    vi.useRealTimers();
    fixture.destroy();
    backend.verify();
  });

  it('lists the next planned lessons of the student, the nearest first', async () => {
    await render();
    const later = scheduledLesson({
      id: 'later',
      ...inHours(48),
      title: 'Теорема Виета',
      topic: 'Корни',
    });
    const group = groupLesson({ id: 'group', ...inHours(24), seriesId: 'series-1' });
    answer([
      later,
      group,
      scheduledLesson({ id: 'cancelled', ...inHours(2), status: 'CANCELLED' }),
      scheduledLesson({ id: 'past', ...inHours(-3) }),
    ]);
    await fixture.whenStable();

    const rows = Array.from(hostElement(fixture).querySelectorAll('li')).map((row) =>
      readableText(row),
    );
    expect(rows).toHaveLength(2);
    expect(rows[0]).toContain('Завтра, ');
    expect(rows[0]).toContain(' Группа «ОГЭ»');
    expect(rows[1]).toContain('Теорема Виета · Корни');
  });

  it('highlights the nearest lesson and says «Сегодня» with the time range', async () => {
    // At noon a lesson in half an hour is still today (after 23:30 it would be tomorrow).
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date().setHours(12, 0, 0, 0));
    await render();
    const soon = scheduledLesson({ id: 'soon', ...inHours(0.5) });
    answer([scheduledLesson({ id: 'far', ...inHours(72) }), soon]);
    await fixture.whenStable();

    const leads = Array.from(hostElement(fixture).querySelectorAll('.tb-list__lead'));
    expect(leads.map((lead) => lead.classList.contains('tb-list__lead--accent'))).toEqual([
      true,
      false,
    ]);
    expect(readableText(requireElement(hostElement(fixture), 'li', HTMLLIElement))).toMatch(
      /^Сегодня, \d\d:\d\d–\d\d:\d\d/,
    );
  });
  it('shows three and counts the rest', async () => {
    await render();
    answer(
      [1, 2, 3, 4, 5].map((day) =>
        scheduledLesson({ id: `l-${String(day)}`, ...inHours(day * 24) }),
      ),
    );
    await fixture.whenStable();

    expect(hostElement(fixture).querySelectorAll('li')).toHaveLength(3);
    expect(readableText(hostElement(fixture))).toContain('Ещё запланировано: 2');
  });

  it('says when nothing is planned and reads again on a new revision', async () => {
    await render();
    answer([]);
    await fixture.whenStable();
    expect(readableText(hostElement(fixture))).toContain('Занятий не запланировано');

    fixture.componentRef.setInput('revision', 1);
    await fixture.whenStable();
    answer([scheduledLesson(inHours(5))]);
    await fixture.whenStable();
    expect(hostElement(fixture).querySelectorAll('li')).toHaveLength(1);
  });

  it('offers a retry when the read fails', async () => {
    await render();
    backend
      .expectOne((r) => r.url === '/api/teacher/schedule/lessons')
      .flush(null, { status: 500, statusText: 'Server Error' });
    await fixture.whenStable();

    buttonByText(hostElement(fixture), 'Повторить').click();
    answer([]);
    await fixture.whenStable();
    expect(readableText(hostElement(fixture))).toContain('Занятий не запланировано');
  });

  it('reads the lessons of a group and leaves its name out of the rows', async () => {
    await render();
    answer([]);
    fixture.componentRef.setInput('of', { groupId: 'g-1' });
    await fixture.whenStable();
    const group = groupLesson({ id: 'group', ...inHours(24), title: 'Дроби' });
    const request = backend.expectOne((r) => r.url === '/api/teacher/schedule/lessons');
    expect(request.request.params.get('groupId')).toBe('g-1');
    request.flush([group]);
    await fixture.whenStable();

    expect(readableText(requireElement(hostElement(fixture), 'li', HTMLLIElement))).toContain(
      'Дроби',
    );
  });
});
