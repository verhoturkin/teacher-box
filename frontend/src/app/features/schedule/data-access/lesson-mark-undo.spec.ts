import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Snackbar } from '@core/snackbar/snackbar';
import { groupLesson, scheduledLesson } from '@testing/schedule-fixtures';
import { testProviders } from '@testing/setup';
import { LessonMarkUndo } from './lesson-mark-undo';

describe('LessonMarkUndo', () => {
  let undo: LessonMarkUndo;
  let backend: HttpTestingController;
  let take: () => void;
  let told: string;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: testProviders() });
    undo = TestBed.inject(LessonMarkUndo);
    backend = TestBed.inject(HttpTestingController);
    vi.spyOn(TestBed.inject(Snackbar), 'undoable').mockImplementation((detail, action) => {
      told = detail;
      take = action;
    });
  });

  afterEach(() => {
    backend.verify();
  });

  it('tells the outcome and reopens a lesson that was not marked', () => {
    const restored = vi.fn();
    const before = scheduledLesson();
    undo.offer(before, { ...before, status: 'MISSED' }, restored);
    expect(told).toBe('Отмечено: пропуск');

    take();
    const reopened = scheduledLesson();
    backend
      .expectOne({ method: 'DELETE', url: '/api/teacher/schedule/lessons/l-1/outcome' })
      .flush(reopened);

    expect(restored).toHaveBeenCalledWith(reopened);
  });

  it('puts the previous outcome back', () => {
    const before = scheduledLesson({ status: 'MISSED' });
    undo.offer(before, { ...before, status: 'CONDUCTED' }, vi.fn());
    expect(told).toBe('Отмечено: проведено');

    take();
    const request = backend.expectOne({
      method: 'PUT',
      url: '/api/teacher/schedule/lessons/l-1/outcome',
    });
    expect(request.request.body).toEqual({ outcome: 'MISSED' });
    request.flush(before);
  });

  it('puts the previous outcome back for a conducted lesson', () => {
    const before = scheduledLesson({ status: 'CONDUCTED' });
    undo.offer(before, { ...before, status: 'MISSED' }, vi.fn());

    take();
    const request = backend.expectOne('/api/teacher/schedule/lessons/l-1/outcome');
    expect(request.request.body).toEqual({ outcome: 'CONDUCTED' });
    request.flush(before);
  });

  it('puts the attendance of a group lesson back', () => {
    const lesson = groupLesson({ status: 'CONDUCTED' });
    const before = {
      ...lesson,
      participants: [
        { ...lesson.participants[0]!, attendance: 'MISSED' as const },
        ...lesson.participants.slice(1),
      ],
    };
    undo.offer(before, { ...before, status: 'CONDUCTED' }, vi.fn());

    take();
    const request = backend.expectOne('/api/teacher/schedule/lessons/gl-1/attendance');
    expect(request.request.body).toEqual({ marks: { 's-1': 'MISSED', 's-2': 'EXCUSED' } });
    request.flush(before);
  });

  it('skips participants that were still expected', () => {
    const before = groupLesson({ status: 'CONDUCTED' });
    undo.offer(before, before, vi.fn());

    take();
    const request = backend.expectOne('/api/teacher/schedule/lessons/gl-1/attendance');
    expect(request.request.body).toEqual({ marks: { 's-2': 'EXCUSED' } });
    request.flush(before);
  });
});
