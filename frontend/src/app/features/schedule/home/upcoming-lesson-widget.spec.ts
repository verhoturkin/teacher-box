import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { aBoard, aLinkBoard } from '@testing/boards-fixtures';
import { hostElement, readableText } from '@testing/dom';
import { groupLesson, scheduledLesson } from '@testing/schedule-fixtures';
import { testProviders } from '@testing/setup';
import { ScheduledLesson } from '../data-access/schedule.models';
import { UpcomingLessonWidget } from './upcoming-lesson-widget';

describe('UpcomingLessonWidget', () => {
  let fixture: ComponentFixture<UpcomingLessonWidget>;
  let backend: HttpTestingController;

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
});
