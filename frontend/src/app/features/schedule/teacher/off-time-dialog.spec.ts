import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { bodyText, buttonByText } from '@testing/dom';
import { onceOffTime, weeklyOffTime } from '@testing/schedule-fixtures';
import { OffTime } from '../data-access/schedule.models';
import { OffTimeDialog } from './off-time-dialog';
import { testProviders } from '@testing/setup';

describe('OffTimeDialog', () => {
  let fixture: ComponentFixture<OffTimeDialog>;
  let backend: HttpTestingController;
  let saved: OffTime[];

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [OffTimeDialog],
      providers: testProviders(),
    });
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(OffTimeDialog);
    saved = [];
    fixture.componentInstance.saved.subscribe((offTime) => saved.push(offTime));
  });

  afterEach(() => {
    backend.verify();
    fixture.destroy();
  });

  async function open(
    offTime: OffTime | null = null,
    timeZone: string | null = null,
  ): Promise<OffTimeDialog> {
    fixture.componentRef.setInput('offTime', offTime);
    fixture.componentRef.setInput('timeZone', timeZone);
    fixture.componentRef.setInput('visible', true);
    await fixture.whenStable();
    return fixture.componentInstance;
  }

  it('adds off time once', async () => {
    const dialog = await open();
    expect(bodyText()).toContain('Нерабочее время');
    expect(bodyText()).toContain('Ученики увидят это время занятым');
    expect(document.body.querySelector('#off-time-starts-at')).not.toBeNull();
    dialog.form.patchValue({
      startsAt: new Date(2026, 9, 5, 0, 0),
      endsAt: new Date(2026, 9, 10, 0, 0),
      note: '  Отпуск ',
    });
    await fixture.whenStable();

    buttonByText(document.body, 'Сохранить').click();

    const request = backend.expectOne({ method: 'POST', url: '/api/teacher/schedule/off-times' });
    expect(request.request.body).toEqual({
      kind: 'ONCE',
      startsAt: new Date(2026, 9, 5, 0, 0).toISOString(),
      endsAt: new Date(2026, 9, 10, 0, 0).toISOString(),
      weekdays: [],
      startTime: null,
      endTime: null,
      startsOn: null,
      endsOn: null,
      note: 'Отпуск',
    });
    request.flush(onceOffTime());
    expect(saved).toEqual([onceOffTime()]);
    expect(dialog.visible()).toBe(false);
  });

  it('adds weekly off time with the fields of its kind only', async () => {
    const dialog = await open(null, 'Pacific/Chatham');
    dialog.form.controls.kind.setValue('WEEKLY');
    await fixture.whenStable();
    expect(document.body.querySelector('#off-time-starts-at')).toBeNull();
    expect(bodyText()).toContain('часовому поясу портала: Pacific/Chatham');
    expect(dialog.form.invalid).toBe(true);

    dialog.form.patchValue({
      weekdays: ['WEDNESDAY', 'MONDAY'],
      startTime: new Date(2026, 0, 1, 13, 0),
      endTime: new Date(2026, 0, 1, 14, 30),
      startsOn: new Date(2026, 9, 1),
      endsOn: new Date(2026, 11, 31),
    });
    await fixture.whenStable();
    buttonByText(document.body, 'Сохранить').click();

    const request = backend.expectOne({ method: 'POST', url: '/api/teacher/schedule/off-times' });
    expect(request.request.body).toEqual({
      kind: 'WEEKLY',
      startsAt: null,
      endsAt: null,
      weekdays: ['MONDAY', 'WEDNESDAY'],
      startTime: '13:00',
      endTime: '14:30',
      startsOn: '2026-10-01',
      endsOn: '2026-12-31',
      note: null,
    });
    request.flush(weeklyOffTime());
    expect(saved).toEqual([weeklyOffTime()]);
  });

  it('changes off time and shows what is wrong', async () => {
    const dialog = await open(weeklyOffTime({ endsOn: '2026-12-31' }));
    expect(bodyText()).toContain('Изменить нерабочее время');
    expect(dialog.form.getRawValue()).toEqual(
      expect.objectContaining({
        kind: 'WEEKLY',
        weekdays: ['MONDAY', 'WEDNESDAY'],
        startsOn: new Date(2026, 8, 1),
        endsOn: new Date(2026, 11, 31),
        note: 'Обед',
      }),
    );
    expect(dialog.form.controls.startTime.value?.getHours()).toBe(13);

    dialog.save();
    backend
      .expectOne({ method: 'PUT', url: '/api/teacher/schedule/off-times/off-1' })
      .flush(
        { status: 422, code: 'schedule.off-time-invalid' },
        { status: 422, statusText: 'Unprocessable Content' },
      );
    await fixture.whenStable();

    expect(bodyText()).toContain('Проверьте нерабочее время');
    expect(saved).toEqual([]);
    expect(dialog.visible()).toBe(true);
  });

  it('opens a one-time period as it was', async () => {
    const dialog = await open(onceOffTime());

    expect(dialog.form.controls.kind.value).toBe('ONCE');
    expect(dialog.form.controls.startsAt.value).toEqual(new Date(onceOffTime().startsAt ?? ''));
    expect(dialog.form.controls.weekdays.disabled).toBe(true);
    dialog.form.controls.startsAt.setValue(null);
    dialog.save();
    backend.expectNone('/api/teacher/schedule/off-times');
  });
});
