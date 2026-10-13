import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { aBoard, aLinkBoard } from '@testing/boards-fixtures';
import { hostElement, readableText } from '@testing/dom';
import { at, groupLesson, scheduledLesson } from '@testing/schedule-fixtures';
import { testProviders } from '@testing/setup';
import { ScheduledLesson } from '../data-access/schedule.models';
import { UpcomingLessonWidget } from './upcoming-lesson-widget';

describe('UpcomingLessonWidget', () => {
  let fixture: ComponentFixture<UpcomingLessonWidget>;
  let backend: HttpTestingController;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
    vi.setSystemTime(new Date(at(2026, 10, 1, 12)));
  });

  async function render(lesson: ScheduledLesson, query: string): Promise<HTMLElement> {
    TestBed.configureTestingModule({ imports: [UpcomingLessonWidget], providers: testProviders() });
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(UpcomingLessonWidget);
    fixture.componentRef.setInput('lesson', lesson);
    fixture.detectChanges();
    backend
      .expectOne(`/api/teacher/boards?${query}`)
      .flush([lesson.groupId === null ? aBoard() : aLinkBoard({ title: 'ОГЭ-доска' })]);
    await fixture.whenStable();
    return hostElement(fixture);
  }

  afterEach(() => {
    backend.verify();
    fixture.destroy();
    vi.useRealTimers();
  });

  it('shows when and with whom, the lesson link and the boards of the student', async () => {
    const host = await render(
      scheduledLesson({
        topic: 'Степени',
        joinUrl: 'https://telemost.yandex.ru/j/1',
        studentAvatar: '/api/public/avatars/ivan',
      }),
      'studentId=s-1',
    );
    const text = readableText(host);

    expect(text).toContain('Следующее занятие');
    expect(text).toContain('Сегодня 18:00 60 мин');
    expect(text).toContain('Иван Петров');
    expect(host.querySelector('tb-avatar img')?.getAttribute('src')).toBe(
      '/api/public/avatars/ivan',
    );
    expect(text).toContain('Степени');
    expect(text).toContain('Начать урок');
    expect(text).toContain('Алгебра');
    expect(host.querySelector('a[href="/teacher/boards/board-1"]')).not.toBeNull();
  });

  it('shows the boards of a group and no lesson link without a room', async () => {
    const host = await render(groupLesson(), 'groupId=g-1');
    const text = readableText(host);

    expect(text).toContain('ОГЭ-доска');
    expect(host.querySelector('a[href="https://app.holst.so/board/1"]')).not.toBeNull();
    expect(text).not.toContain('Начать урок');
  });

  it('counts down, offers to join while the lesson runs and reports its end', async () => {
    const host = await render(
      scheduledLesson({ joinUrl: 'https://telemost.yandex.ru/j/1' }),
      'studentId=s-1',
    );
    const ended = vi.fn();
    fixture.componentInstance.over.subscribe(ended);

    vi.setSystemTime(new Date(at(2026, 10, 1, 17, 35)));
    vi.advanceTimersByTime(15_000);
    fixture.detectChanges();
    expect(readableText(host)).toContain('через 25 мин');

    vi.setSystemTime(new Date(at(2026, 10, 1, 18, 40)));
    vi.advanceTimersByTime(15_000);
    fixture.detectChanges();
    expect(readableText(host)).toContain('Идёт сейчас 18:00 ещё 20 мин');
    expect(readableText(host)).toContain('Войти в урок');
    expect(ended).not.toHaveBeenCalled();

    vi.setSystemTime(new Date(at(2026, 10, 1, 19)));
    vi.advanceTimersByTime(15_000);
    fixture.detectChanges();
    vi.advanceTimersByTime(15_000);
    fixture.detectChanges();
    expect(ended).toHaveBeenCalledTimes(1);
  });
});
