import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Snackbar } from '@core/snackbar/snackbar';
import { bodyText, buttonByText } from '@testing/dom';
import { groupLesson } from '@testing/schedule-fixtures';
import { ScheduledLesson } from '../data-access/schedule.models';
import { AttendanceDialog } from './attendance-dialog';
import { testProviders } from '@testing/setup';

describe('AttendanceDialog', () => {
  let fixture: ComponentFixture<AttendanceDialog>;
  let backend: HttpTestingController;
  let saved: ScheduledLesson[];

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [AttendanceDialog],
      providers: testProviders(),
    });
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(AttendanceDialog);
    saved = [];
    fixture.componentInstance.saved.subscribe((lesson) => saved.push(lesson));
    fixture.componentRef.setInput('lesson', groupLesson());
    fixture.componentRef.setInput('visible', true);
    await fixture.whenStable();
  });

  afterEach(() => {
    backend.verify();
    fixture.destroy();
  });

  it('marks everybody as attended unless they excused themselves', async () => {
    const dialog = fixture.componentInstance;
    expect(bodyText()).toContain('Группа «ОГЭ»');
    expect(dialog.marks()).toEqual({ 's-1': 'ATTENDED', 's-2': 'EXCUSED' });

    dialog.set('s-1', 'MISSED');
    buttonByText(document.body, 'Сохранить').click();

    const request = backend.expectOne({
      method: 'PUT',
      url: '/api/teacher/schedule/lessons/gl-1/attendance',
    });
    expect(request.request.body).toEqual({ marks: { 's-1': 'MISSED', 's-2': 'EXCUSED' } });
    request.flush(groupLesson({ status: 'MISSED' }));
    await fixture.whenStable();

    expect(saved.map((lesson) => lesson.status)).toEqual(['MISSED']);
    expect(dialog.visible()).toBe(false);
  });

  it('offers to take the attendance back and tells when it is back', () => {
    const undoable = vi.spyOn(TestBed.inject(Snackbar), 'undoable');
    const restored: ScheduledLesson[] = [];
    fixture.componentInstance.restored.subscribe((lesson) => restored.push(lesson));

    fixture.componentInstance.save();
    backend
      .expectOne('/api/teacher/schedule/lessons/gl-1/attendance')
      .flush(groupLesson({ status: 'CONDUCTED' }));
    expect(undoable).toHaveBeenCalledWith('Отмечено: проведено', expect.any(Function));

    undoable.mock.calls[0]?.[1]();
    backend
      .expectOne({ method: 'DELETE', url: '/api/teacher/schedule/lessons/gl-1/outcome' })
      .flush(groupLesson());

    expect(restored.map((lesson) => lesson.status)).toEqual(['SCHEDULED']);
  });

  it('asks to cancel instead when nobody came', async () => {
    const dialog = fixture.componentInstance;
    dialog.set('s-1', 'EXCUSED');
    await fixture.whenStable();

    dialog.save();
    backend.expectNone('/api/teacher/schedule/lessons/gl-1/attendance');
    expect(bodyText()).toContain('Отметьте хотя бы одного ученика');
  });

  it('shows why the marks were not saved', async () => {
    fixture.componentInstance.save();
    backend
      .expectOne('/api/teacher/schedule/lessons/gl-1/attendance')
      .flush(
        { status: 422, code: 'schedule.lesson-not-started' },
        { status: 422, statusText: 'Unprocessable' },
      );
    await fixture.whenStable();

    expect(bodyText()).toContain('Занятие ещё не началось');
    expect(saved).toEqual([]);
  });
});
