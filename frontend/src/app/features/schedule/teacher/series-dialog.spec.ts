import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { providePrimeNG } from 'primeng/config';
import { bodyText, buttonByText } from '@testing/dom';
import { lessonSeries } from '@testing/schedule-fixtures';
import { LessonSeries, SeriesPlanned } from '../data-access/schedule.models';
import { SeriesDialog, fromTime, toTime } from './series-dialog';

describe('SeriesDialog', () => {
  let fixture: ComponentFixture<SeriesDialog>;
  let backend: HttpTestingController;
  let saved: SeriesPlanned[];

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [SeriesDialog],
      providers: [provideHttpClient(), provideHttpClientTesting(), providePrimeNG()],
    });
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(SeriesDialog);
    fixture.componentRef.setInput('students', [{ id: 's-1', displayName: 'Иван' }]);
    saved = [];
    fixture.componentInstance.saved.subscribe((planned) => saved.push(planned));
  });

  afterEach(() => {
    backend.verify();
    fixture.destroy();
  });

  async function open(series: LessonSeries | null = null, timeZone: string | null = null): Promise<SeriesDialog> {
    fixture.componentRef.setInput('series', series);
    fixture.componentRef.setInput('timeZone', timeZone);
    fixture.componentRef.setInput('visible', true);
    await fixture.whenStable();
    return fixture.componentInstance;
  }

  it('plans regular lessons', async () => {
    const dialog = await open();
    expect(bodyText()).toContain('Регулярные занятия');
    dialog.form.patchValue({
      studentId: 's-1',
      weekdays: ['THURSDAY', 'TUESDAY'],
      startTime: new Date(2026, 0, 1, 18, 30),
      intervalWeeks: 2,
      startsOn: new Date(2026, 9, 1),
      endsOn: new Date(2026, 11, 31),
      topic: 'Английский',
    });
    await fixture.whenStable();

    buttonByText(document.body, 'Сохранить').click();

    const request = backend.expectOne({ method: 'POST', url: '/api/teacher/schedule/series' });
    expect(request.request.body).toEqual({
      studentId: 's-1',
      weekdays: ['TUESDAY', 'THURSDAY'],
      startTime: '18:30',
      durationMinutes: 60,
      intervalWeeks: 2,
      startsOn: '2026-10-01',
      endsOn: '2026-12-31',
      topic: 'Английский',
      meetingUrl: null,
      allowOverlap: false,
    });
    request.flush({ series: lessonSeries(), lessons: 24 });
    expect(saved.map((planned) => planned.lessons)).toEqual([24]);
  });

  it('offers to save overlapping lessons anyway and shows other errors', async () => {
    const dialog = await open();
    dialog.form.patchValue({
      studentId: 's-1',
      weekdays: ['MONDAY'],
      startTime: new Date(2026, 0, 1, 9, 0),
      startsOn: new Date(2026, 9, 5),
    });

    dialog.save();
    backend
      .expectOne('/api/teacher/schedule/series')
      .flush({ status: 409, code: 'schedule.overlap' }, { status: 409, statusText: 'Conflict' });
    await fixture.whenStable();
    expect(bodyText()).toContain('пересекаются с уже запланированными');

    buttonByText(document.body, 'Всё равно сохранить').click();
    backend
      .expectOne('/api/teacher/schedule/series')
      .flush({ status: 422, code: 'schedule.series-dates-invalid' }, { status: 422, statusText: 'Unprocessable' });
    await fixture.whenStable();

    expect(bodyText()).toContain('Дата окончания раньше даты начала');
    expect(saved).toHaveLength(0);
  });

  it('changes a series from a day on and explains the time zone', async () => {
    const dialog = await open(
      lessonSeries({ startsOn: '2020-01-01', endsOn: '2030-06-30', topic: 'Дроби', meetingUrl: 'https://zoom.us/j/1' }),
      'Pacific/Chatham',
    );

    expect(bodyText()).toContain('Изменить регулярные занятия');
    expect(bodyText()).toContain('Время указывается по часовому поясу портала: Pacific/Chatham');
    expect(dialog.form.controls.studentId.disabled).toBe(true);
    expect(dialog.form.controls.weekdays.value).toEqual(['TUESDAY', 'THURSDAY']);
    expect(dialog.form.controls.startsOn.value?.getFullYear()).toBeGreaterThanOrEqual(2026);

    dialog.save();

    const request = backend.expectOne({ method: 'PUT', url: '/api/teacher/schedule/series/sr-1' });
    expect(request.request.body).toEqual(
      expect.objectContaining({ startTime: '18:00', endsOn: '2030-06-30', topic: 'Дроби' }),
    );
    request.flush({ series: lessonSeries(), lessons: 3 });
    expect(saved).toHaveLength(1);
  });

  it('does not send an incomplete series', async () => {
    const dialog = await open();

    dialog.save();

    expect(dialog.form.invalid).toBe(true);
  });

  it('converts times of the time picker', () => {
    expect(toTime(new Date(2026, 0, 1, 7, 5))).toBe('07:05');
    const date = fromTime('18:30:00');
    expect([date.getHours(), date.getMinutes()]).toEqual([18, 30]);
  });
});
