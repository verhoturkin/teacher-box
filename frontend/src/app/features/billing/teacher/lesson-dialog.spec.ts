import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { providePrimeNG } from 'primeng/config';
import { lesson, studentBalance } from '@testing/billing-fixtures';
import { bodyText, buttonByText } from '@testing/dom';
import { Lesson } from '../data-access/billing.models';
import { LessonDialog } from './lesson-dialog';

describe('LessonDialog', () => {
  let fixture: ComponentFixture<LessonDialog>;
  let backend: HttpTestingController;
  const students = [
    studentBalance({ studentId: 's-1', displayName: 'Иван', lessonPrice: 150_000 }),
    studentBalance({ studentId: 's-2', displayName: 'Мария', lessonPrice: 200_050 }),
  ];

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [LessonDialog],
      providers: [provideHttpClient(), provideHttpClientTesting(), providePrimeNG()],
    });
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(LessonDialog);
    fixture.componentRef.setInput('students', students);
    fixture.componentRef.setInput('currency', 'RUB');
    fixture.componentRef.setInput('defaultDuration', 45);
  });

  afterEach(() => {
    backend.verify();
    fixture.destroy();
  });

  async function open(studentId: string | null): Promise<LessonDialog> {
    fixture.componentRef.setInput('studentId', studentId);
    fixture.componentRef.setInput('visible', true);
    await fixture.whenStable();
    return fixture.componentInstance;
  }

  it('prefills the selected student with price and default duration', async () => {
    const dialog = await open('s-2');

    expect(bodyText()).toContain('Занятие');
    expect(dialog.form.getRawValue()).toEqual(
      expect.objectContaining({ studentId: 's-2', price: 2000.5, durationMinutes: 45, status: 'CONDUCTED' }),
    );
  });

  it('follows the price of a newly selected student', async () => {
    const dialog = await open(null);
    expect(dialog.form.controls.price.value).toBeNull();

    dialog.form.controls.studentId.setValue('s-1');

    expect(dialog.form.controls.price.value).toBe(1500);
  });

  it('records the lesson in minor units', async () => {
    const saved: Lesson[] = [];
    fixture.componentInstance.saved.subscribe((value) => saved.push(value));
    const dialog = await open('s-1');
    dialog.form.patchValue({
      date: new Date(2026, 8, 7),
      status: 'MISSED',
      durationMinutes: 90,
      price: 1800.5,
      topic: '  Проценты ',
    });
    await fixture.whenStable();

    buttonByText(document.body, 'Записать').click();

    const request = backend.expectOne('/api/teacher/billing/lessons');
    expect(request.request.body).toEqual({
      studentId: 's-1',
      date: '2026-09-07',
      status: 'MISSED',
      durationMinutes: 90,
      price: 180_050,
      topic: 'Проценты',
    });
    request.flush(lesson());
    await fixture.whenStable();

    expect(saved).toHaveLength(1);
    expect(dialog.visible()).toBe(false);
  });

  it('sends an empty topic as null and keeps the dialog open on errors', async () => {
    const dialog = await open('s-1');
    buttonByText(document.body, 'Записать').click();

    const request = backend.expectOne('/api/teacher/billing/lessons');
    expect(request.request.body).toEqual(expect.objectContaining({ topic: null, durationMinutes: 45 }));
    request.flush({ status: 404, code: 'student.not-found' }, { status: 404, statusText: 'Not Found' });
    await fixture.whenStable();

    expect(bodyText()).toContain('Ученик не найден');
    expect(dialog.visible()).toBe(true);
  });

  it('does nothing while the form is invalid', async () => {
    const dialog = await open(null);

    dialog.save();

    backend.expectNone('/api/teacher/billing/lessons');
  });

  it('closes on cancel', async () => {
    const dialog = await open('s-1');

    buttonByText(document.body, 'Отмена').click();

    expect(dialog.visible()).toBe(false);
  });
});
