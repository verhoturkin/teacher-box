import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Snackbar } from '@core/snackbar/snackbar';
import { bodyText, buttonByText, requireElement, typeInto } from '@testing/dom';
import { groupLesson, scheduledLesson } from '@testing/schedule-fixtures';
import { testProviders } from '@testing/setup';
import { ScheduledLesson } from '../data-access/schedule.models';
import { LessonSummaryDialog } from './lesson-summary-dialog';

const SUMMARY = '/api/teacher/schedule/lessons/l-1/summary';
const NOTE_FIELD = 'textarea[aria-label^="Заметка для себя"]';

describe('LessonSummaryDialog', () => {
  let fixture: ComponentFixture<LessonSummaryDialog>;
  let backend: HttpTestingController;
  let saved: ScheduledLesson[];
  let success: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [LessonSummaryDialog], providers: testProviders() });
    backend = TestBed.inject(HttpTestingController);
    success = vi.spyOn(TestBed.inject(Snackbar), 'success');
    fixture = TestBed.createComponent(LessonSummaryDialog);
    saved = [];
    fixture.componentInstance.saved.subscribe((lesson) => saved.push(lesson));
  });

  afterEach(() => {
    backend.verify();
    fixture.destroy();
  });

  async function open(lesson: ScheduledLesson): Promise<void> {
    fixture.componentRef.setInput('lesson', lesson);
    fixture.componentRef.setInput('visible', true);
    await fixture.whenStable();
  }

  function field(selector: string): HTMLTextAreaElement {
    return requireElement(document.body, selector, HTMLTextAreaElement);
  }

  async function type(selector: string, value: string): Promise<void> {
    typeInto(field(selector), value);
    await fixture.whenStable();
  }

  function mode(label: string): HTMLElement | undefined {
    return Array.from(document.body.querySelectorAll<HTMLElement>('p-togglebutton')).find(
      (option) => option.textContent.includes(label),
    );
  }

  it('writes nothing by itself and saves the changed fields at «Сохранить»', async () => {
    await open(scheduledLesson());
    await type('#lesson-summary-text', ' Past Simple ');
    await type('#lesson-summary-next', 'Past Continuous');
    backend.expectNone(SUMMARY);

    buttonByText(document.body, 'Сохранить').click();
    await fixture.whenStable();
    const request = backend.expectOne(SUMMARY);
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({ summary: 'Past Simple', nextPlan: 'Past Continuous' });
    const updated = scheduledLesson({ summary: 'Past Simple', nextPlan: 'Past Continuous' });
    request.flush(updated);
    await fixture.whenStable();

    expect(saved).toEqual([updated]);
    expect(success).toHaveBeenCalledWith('Итоги сохранены');
    expect(fixture.componentInstance.visible()).toBe(false);
  });

  it('closes without a request when nothing changed', async () => {
    await open(scheduledLesson({ summary: 'Было' }));

    buttonByText(document.body, 'Сохранить').click();
    await fixture.whenStable();

    expect(fixture.componentInstance.visible()).toBe(false);
    expect(saved).toHaveLength(1);
  });

  it('clears an emptied field', async () => {
    await open(scheduledLesson({ summary: 'Было', nextPlan: 'План' }));
    await type('#lesson-summary-text', '  ');
    await type('#lesson-summary-next', '');

    buttonByText(document.body, 'Сохранить').click();
    await fixture.whenStable();

    const request = backend.expectOne(SUMMARY);
    expect(request.request.body).toEqual({ summary: null, nextPlan: null });
    request.flush(scheduledLesson());
  });

  it('saves and sends: the write first, then the share', async () => {
    await open(scheduledLesson());
    await type('#lesson-summary-text', 'Прошли Past Simple');

    buttonByText(document.body, 'Сохранить и отправить').click();
    await fixture.whenStable();
    backend.expectNone('/api/teacher/schedule/lessons/l-1/summary/share');
    const updated = scheduledLesson({ summary: 'Прошли Past Simple' });
    backend.expectOne(SUMMARY).flush(updated);
    await fixture.whenStable();
    backend.expectOne('/api/teacher/schedule/lessons/l-1/summary/share').flush(null);
    await fixture.whenStable();

    expect(saved).toEqual([updated]);
    expect(success).toHaveBeenCalledWith('Итоги отправлены');
  });

  it('sends a saved summary without writing it again', async () => {
    await open(scheduledLesson({ summary: 'Готово' }));

    buttonByText(document.body, 'Сохранить и отправить').click();
    await fixture.whenStable();

    backend.expectOne('/api/teacher/schedule/lessons/l-1/summary/share').flush(null);
    await fixture.whenStable();
    expect(saved).toHaveLength(1);
  });

  it('does not send an empty summary', async () => {
    await open(scheduledLesson());

    expect(buttonByText(document.body, 'Сохранить и отправить').disabled).toBe(true);
    backend.expectNone(SUMMARY);
  });

  it('tells a failed save and stays open', async () => {
    await open(scheduledLesson());
    await type('#lesson-summary-text', 'Текст');

    buttonByText(document.body, 'Сохранить').click();
    await fixture.whenStable();
    backend.expectOne(SUMMARY).flush({}, { status: 500, statusText: 'Server Error' });
    await fixture.whenStable();

    expect(bodyText()).toContain('Не удалось сохранить итоги');
    expect(fixture.componentInstance.visible()).toBe(true);
    expect(success).not.toHaveBeenCalled();
  });

  it('shows the Markdown preview and back', async () => {
    await open(scheduledLesson({ summary: '**Жирный**' }));

    mode('Просмотр')?.click();
    await fixture.whenStable();
    expect(document.body.querySelector('.tb-preview strong')?.textContent).toBe('Жирный');

    mode('Текст')?.click();
    await fixture.whenStable();
    expect(document.body.querySelector('.tb-preview')).toBeNull();
  });

  it('saves the private note of a lesson with one student', async () => {
    await open(
      scheduledLesson({
        notes: [{ studentId: 's-1', note: 'Старое', updatedAt: '2026-10-01T00:00:00Z' }],
      }),
    );
    expect(field('#lesson-summary-note').value).toBe('Старое');
    await type('#lesson-summary-note', 'Путает времена');

    buttonByText(document.body, 'Сохранить').click();
    await fixture.whenStable();

    const request = backend.expectOne('/api/teacher/schedule/lessons/l-1/notes/s-1');
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({ note: 'Путает времена' });
    request.flush(scheduledLesson());
  });

  it('lists the students of a group, each note folds open; the summary and the notes save in turn', async () => {
    await open(
      groupLesson({
        notes: [{ studentId: 's-2', note: 'Хорошо', updatedAt: '2026-10-01T00:00:00Z' }],
      }),
    );
    expect(bodyText()).toContain('Иван Петров');
    expect(bodyText()).toContain('Хорошо');
    expect(document.body.querySelector(NOTE_FIELD)).toBeNull();

    const rows = document.body.querySelectorAll<HTMLButtonElement>('.tb-lesson-summary__expand');
    rows[1]?.click();
    await fixture.whenStable();
    expect(field(NOTE_FIELD).value).toBe('Хорошо');
    expect(rows[1]?.getAttribute('aria-expanded')).toBe('true');
    await type(NOTE_FIELD, '');
    await type('#lesson-summary-text', 'Итоги');

    buttonByText(document.body, 'Сохранить').click();
    await fixture.whenStable();
    backend.expectOne('/api/teacher/schedule/lessons/gl-1/summary').flush(groupLesson());
    await fixture.whenStable();
    const note = backend.expectOne('/api/teacher/schedule/lessons/gl-1/notes/s-2');
    expect(note.request.body).toEqual({ note: null });
    note.flush(groupLesson());
    await fixture.whenStable();
    expect(saved).toHaveLength(1);
  });

  it('folds a student note shut again', async () => {
    await open(groupLesson());
    const row = requireElement(document.body, '.tb-lesson-summary__expand', HTMLButtonElement);

    row.click();
    await fixture.whenStable();
    expect(document.body.querySelector(NOTE_FIELD)).not.toBeNull();
    row.click();
    await fixture.whenStable();
    expect(document.body.querySelector(NOTE_FIELD)).toBeNull();
  });
});
