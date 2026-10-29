import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { bodyText, buttonByText } from '@testing/dom';
import { scheduledLesson } from '@testing/schedule-fixtures';
import { ScheduledLesson } from '../data-access/schedule.models';
import { LessonDialog } from './lesson-dialog';
import { testProviders } from '@testing/setup';

describe('LessonDialog', () => {
  let fixture: ComponentFixture<LessonDialog>;
  let backend: HttpTestingController;
  let saved: ScheduledLesson[];

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [LessonDialog],
      providers: testProviders(),
    });
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(LessonDialog);
    fixture.componentRef.setInput('students', [
      { id: 's-1', displayName: 'Иван' },
      { id: 's-2', displayName: 'Мария' },
    ]);
    fixture.componentRef.setInput('defaultDuration', 45);
    saved = [];
    fixture.componentInstance.saved.subscribe((lesson) => saved.push(lesson));
  });

  afterEach(() => {
    backend.verify();
    fixture.destroy();
  });

  async function open(
    lesson: ScheduledLesson | null = null,
    slot: { start: Date; durationMinutes: number } | null = null,
  ) {
    fixture.componentRef.setInput('lesson', lesson);
    fixture.componentRef.setInput('slot', slot);
    fixture.componentRef.setInput('visible', true);
    await fixture.whenStable();
    return fixture.componentInstance;
  }

  it.each([0, 1, 2, 3, 4])(
    'saves repeat interval %i from the unified lesson form',
    async (weeks) => {
      const dialog = await open(null, { start: new Date(2026, 9, 1, 18), durationMinutes: 60 });
      dialog.form.patchValue({ owner: 'student:s-1', repeatWeeks: weeks });
      await fixture.whenStable();
      expect(document.body.querySelector('#schedule-lesson-repeat')).not.toBeNull();
      expect(document.body.querySelector('#schedule-lesson-repeat-until') !== null).toBe(weeks > 0);
      dialog.save();
      const request = backend.expectOne({ method: 'POST', url: '/api/teacher/schedule/lessons' });
      expect(request.request.body).toMatchObject({
        repeatWeeks: weeks,
        scope: 'ONLY',
        repeatUntil: null,
      });
      request.flush(scheduledLesson({ repeatWeeks: weeks }));
    },
  );

  it('waits for the affected set before changing following occurrences', async () => {
    const lesson = scheduledLesson({
      seriesId: 'rule-1',
      repeatWeeks: 3,
      version: 2,
      repeatVersion: 4,
    });
    const dialog = await open(lesson);
    dialog.form.controls.repeatWeeks.setValue(4);
    await fixture.whenStable();
    dialog.save();
    backend.expectNone({ method: 'PUT', url: '/api/teacher/schedule/lessons/l-1' });
    backend
      .expectOne('/api/teacher/schedule/lessons/l-1/following')
      .flush({ repeatVersion: 4, affected: ['l-1', 'l-2'], protectedLessons: ['l-3'] });
    await fixture.whenStable();
    expect(bodyText()).toContain('Существующих занятий для изменения: 2');
    dialog.save();
    const request = backend.expectOne({ method: 'PUT', url: '/api/teacher/schedule/lessons/l-1' });
    expect(request.request.body).toMatchObject({
      repeatWeeks: 4,
      scope: 'FOLLOWING',
      version: 2,
      repeatVersion: 4,
    });
    request.flush(scheduledLesson({ repeatWeeks: 4 }));
  });

  it('plans a lesson in the selected slot', async () => {
    const start = new Date(2026, 9, 1, 18, 0);
    const dialog = await open(null, { start, durationMinutes: 90 });
    expect(bodyText()).toContain('Новое занятие');
    expect(dialog.form.getRawValue()).toEqual(
      expect.objectContaining({ owner: null, startsAt: start, durationMinutes: 90 }),
    );
    dialog.form.patchValue({
      owner: 'student:s-2',
      topic: '  Дроби ',
      meetingUrl: 'https://zoom.us/j/1',
    });
    await fixture.whenStable();

    buttonByText(document.body, 'Сохранить').click();

    const request = backend.expectOne({ method: 'POST', url: '/api/teacher/schedule/lessons' });
    expect(request.request.body).toMatchObject({
      studentId: 's-2',
      groupId: null,
      startsAt: start.toISOString(),
      durationMinutes: 90,
      title: 'Дроби',
      topic: null,
      meetingUrl: 'https://zoom.us/j/1',
      allowOverlap: false,
    });
    request.flush(scheduledLesson());
    expect(saved).toHaveLength(1);
    expect(fixture.componentInstance.visible()).toBe(false);
  });

  it('offers to save an overlapping lesson anyway', async () => {
    const dialog = await open();
    dialog.form.patchValue({ owner: 'group:g-1', startsAt: new Date(2026, 9, 1, 18) });
    expect(dialog.form.controls.durationMinutes.value).toBe(45);

    dialog.save();
    backend
      .expectOne('/api/teacher/schedule/lessons')
      .flush({ status: 409, code: 'schedule.overlap' }, { status: 409, statusText: 'Conflict' });
    await fixture.whenStable();
    expect(bodyText()).toContain('Время пересекается с другим занятием');

    buttonByText(document.body, 'Всё равно сохранить').click();
    const retry = backend.expectOne('/api/teacher/schedule/lessons');
    expect(retry.request.body).toMatchObject(
      expect.objectContaining({
        studentId: null,
        groupId: 'g-1',
        allowOverlap: true,
        title: null,
        topic: null,
        meetingUrl: null,
      }),
    );
    retry.flush(scheduledLesson());
    expect(saved).toHaveLength(1);
  });

  it('shows other errors and rejects bad links', async () => {
    const dialog = await open();
    dialog.form.patchValue({
      owner: 'student:s-1',
      startsAt: new Date(2026, 9, 1, 18),
      meetingUrl: 'zoom',
    });
    await fixture.whenStable();
    expect(dialog.form.invalid).toBe(true);
    expect(bodyText()).toContain('Ссылка должна начинаться с http:// или https://');
    dialog.save();

    dialog.form.patchValue({ meetingUrl: '' });
    dialog.save();
    backend
      .expectOne('/api/teacher/schedule/lessons')
      .flush(
        { status: 404, code: 'schedule.student-not-found' },
        { status: 404, statusText: 'Not Found' },
      );
    await fixture.whenStable();

    expect(bodyText()).toContain('Ученик не найден или отключён');
    expect(saved).toHaveLength(0);
  });

  it('keeps what is typed when inputs change while it is open', async () => {
    const dialog = await open();
    dialog.form.patchValue({ owner: 'student:s-1', topic: 'Дроби' });

    fixture.componentRef.setInput('defaultDuration', 60);
    fixture.componentRef.setInput('students', [{ id: 's-1', displayName: 'Иван' }]);
    await fixture.whenStable();

    expect(dialog.form.getRawValue()).toEqual(
      expect.objectContaining({ owner: 'student:s-1', topic: 'Дроби' }),
    );
  });

  it('fills in the default topic of the chosen student or group', async () => {
    fixture.componentRef.setInput('students', [
      { id: 's-1', displayName: 'Иван', defaultTopic: 'Физика' },
      { id: 's-2', displayName: 'Мария', defaultTopic: null },
    ]);
    fixture.componentRef.setInput('groups', [
      { id: 'g-1', name: 'ОГЭ', defaultTopic: 'Математика' },
    ]);
    const dialog = await open();
    const topic = dialog.form.controls.topic;

    dialog.form.controls.owner.setValue('student:s-1');
    expect(topic.value).toBe('Физика');
    dialog.form.controls.owner.setValue('group:g-1');
    expect(topic.value).toBe('Математика');
    dialog.form.controls.owner.setValue('student:s-2');
    expect(topic.value).toBe('');

    topic.setValue('Своя тема');
    dialog.form.controls.owner.setValue('student:s-1');
    expect(topic.value).toBe('Своя тема');
  });

  it('plans with the student of the card: fixed, with their default topic', async () => {
    fixture.componentRef.setInput('students', [
      { id: 's-1', displayName: 'Иван', defaultTopic: 'Физика' },
    ]);
    fixture.componentRef.setInput('studentId', 's-1');
    const dialog = await open();

    expect(dialog.form.controls.owner.value).toBe('student:s-1');
    expect(dialog.form.controls.owner.disabled).toBe(true);
    expect(dialog.form.controls.topic.value).toBe('Физика');
  });

  it('plans with the group of the card: fixed, with its default topic', async () => {
    fixture.componentRef.setInput('groups', [{ id: 'g-1', name: 'ОГЭ', defaultTopic: 'Дроби' }]);
    fixture.componentRef.setInput('groupId', 'g-1');
    const dialog = await open();

    expect(dialog.form.controls.owner.value).toBe('group:g-1');
    expect(dialog.form.controls.owner.disabled).toBe(true);
    expect(dialog.form.controls.topic.value).toBe('Дроби');
  });

  it('keeps the topic of a planned lesson', async () => {
    fixture.componentRef.setInput('students', [
      { id: 's-1', displayName: 'Иван', defaultTopic: 'Физика' },
    ]);
    const dialog = await open(scheduledLesson({ title: null }));
    expect(dialog.form.controls.topic.value).toBe('');
  });

  it('changes a planned lesson', async () => {
    const lesson = scheduledLesson({
      title: 'Степени',
      topic: 'Дроби',
      meetingUrl: 'https://zoom.us/j/2',
    });
    const dialog = await open(lesson);
    expect(bodyText()).toContain('Изменить занятие');
    expect(dialog.form.controls.owner.disabled).toBe(true);
    expect(dialog.form.controls.owner.value).toBe('student:s-1');
    expect(dialog.form.controls.startsAt.value).toEqual(new Date(lesson.startsAt));

    dialog.form.patchValue({ durationMinutes: 30 });
    dialog.save();

    const request = backend.expectOne({ method: 'PUT', url: '/api/teacher/schedule/lessons/l-1' });
    expect(request.request.body).toMatchObject({
      startsAt: lesson.startsAt,
      durationMinutes: 30,
      title: 'Степени',
      topic: 'Дроби',
      meetingUrl: 'https://zoom.us/j/2',
      allowOverlap: false,
    });
    request.flush(lesson);
    expect(saved).toEqual([lesson]);
  });
});
