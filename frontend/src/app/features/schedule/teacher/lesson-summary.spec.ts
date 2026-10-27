import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Snackbar } from '@core/snackbar/snackbar';
import { buttonByText, hostElement, typeInto } from '@testing/dom';
import { groupLesson, scheduledLesson } from '@testing/schedule-fixtures';
import { testProviders } from '@testing/setup';
import { ScheduledLesson } from '../data-access/schedule.models';
import { LessonSummary } from './lesson-summary';

const NOTE_FIELD = 'textarea[aria-label^="Заметка для себя"]';

describe('LessonSummary', () => {
  let fixture: ComponentFixture<LessonSummary>;
  let backend: HttpTestingController;
  let saved: ScheduledLesson[];

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [LessonSummary], providers: testProviders() });
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(LessonSummary);
    saved = [];
    fixture.componentInstance.changed.subscribe((lesson) => saved.push(lesson));
  });

  afterEach(() => {
    backend.verify();
  });

  async function show(lesson: ScheduledLesson): Promise<HTMLElement> {
    fixture.componentRef.setInput('lesson', lesson);
    await fixture.whenStable();
    return hostElement(fixture);
  }

  function field(host: HTMLElement, label: string): HTMLTextAreaElement {
    const found = Array.from(host.querySelectorAll('label')).find((l) =>
      l.textContent.includes(label),
    );
    const id = found?.getAttribute('for') ?? '';
    const area = host.querySelector<HTMLTextAreaElement>(`textarea[id="${id}"]`);
    if (area === null) {
      throw new Error(`Field "${label}" not found`);
    }
    return area;
  }

  function noteField(host: HTMLElement): HTMLTextAreaElement {
    const area = host.querySelector<HTMLTextAreaElement>(NOTE_FIELD);
    if (area === null) {
      throw new Error('Note field not found');
    }
    return area;
  }

  async function type(area: HTMLTextAreaElement, value: string): Promise<void> {
    typeInto(area, value);
    await fixture.whenStable();
  }

  async function blur(area: HTMLTextAreaElement): Promise<void> {
    area.dispatchEvent(new Event('blur'));
    await fixture.whenStable();
  }

  function mode(host: HTMLElement, label: string): HTMLElement | undefined {
    return Array.from(host.querySelectorAll<HTMLElement>('p-selectbutton p-togglebutton')).find(
      (option) => option.textContent.includes(label),
    );
  }

  it('saves «Что прошли» and «Что дальше» when a field loses focus', async () => {
    const host = await show(scheduledLesson());

    const covered = field(host, 'Что прошли');
    await type(covered, ' Past Simple ');
    await type(field(host, 'Что дальше'), 'Past Continuous');
    await blur(covered);

    const request = backend.expectOne('/api/teacher/schedule/lessons/l-1/summary');
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({ summary: 'Past Simple', nextPlan: 'Past Continuous' });
    expect(host.textContent).toContain('Сохраняется…');
    const updated = scheduledLesson({ summary: 'Past Simple', nextPlan: 'Past Continuous' });
    request.flush(updated);
    await fixture.whenStable();

    expect(host.textContent).toContain('Сохранено');
    expect(saved).toEqual([updated]);
  });

  it('does not save what did not change and clears an emptied field', async () => {
    const host = await show(scheduledLesson({ summary: 'Было', nextPlan: null }));

    await blur(field(host, 'Что прошли'));
    backend.expectNone('/api/teacher/schedule/lessons/l-1/summary');

    const covered = field(host, 'Что прошли');
    await type(covered, '  ');
    await blur(covered);
    const request = backend.expectOne('/api/teacher/schedule/lessons/l-1/summary');
    expect(request.request.body).toEqual({ summary: null, nextPlan: null });
    request.flush(scheduledLesson());
  });

  it('shows the Markdown preview and back', async () => {
    const host = await show(scheduledLesson({ summary: '**Жирный**' }));

    mode(host, 'Просмотр')?.click();
    await fixture.whenStable();
    expect(host.querySelector('.tb-preview strong')?.textContent).toBe('Жирный');

    mode(host, 'Текст')?.click();
    await fixture.whenStable();
    expect(host.querySelector('.tb-preview')).toBeNull();
  });

  it('saves the private note of a lesson with one student', async () => {
    const host = await show(
      scheduledLesson({
        notes: [{ studentId: 's-1', note: 'Старое', updatedAt: '2026-10-01T00:00:00Z' }],
      }),
    );

    const note = field(host, 'Заметка для себя');
    expect(note.value).toBe('Старое');
    await blur(note);
    backend.expectNone('/api/teacher/schedule/lessons/l-1/notes/s-1');

    await type(note, 'Путает времена');
    await blur(note);
    const request = backend.expectOne('/api/teacher/schedule/lessons/l-1/notes/s-1');
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({ note: 'Путает времена' });
    request.flush(scheduledLesson());
    await fixture.whenStable();
    expect(saved).toHaveLength(1);
  });

  it('lists the students of a group, each note folds open', async () => {
    const host = await show(
      groupLesson({
        notes: [{ studentId: 's-2', note: 'Хорошо', updatedAt: '2026-10-01T00:00:00Z' }],
      }),
    );
    expect(host.textContent).toContain('Иван Петров');
    expect(host.textContent).toContain('Хорошо');
    expect(host.querySelector(NOTE_FIELD)).toBeNull();

    const rows = host.querySelectorAll<HTMLButtonElement>('.tb-lesson-summary__expand');
    rows[1]?.click();
    await fixture.whenStable();
    const area = noteField(host);
    expect(area.value).toBe('Хорошо');
    expect(rows[1]?.getAttribute('aria-expanded')).toBe('true');

    await type(area, 'Отлично');
    await blur(area);
    const request = backend.expectOne('/api/teacher/schedule/lessons/gl-1/notes/s-2');
    expect(request.request.body).toEqual({ note: 'Отлично' });
    request.flush(groupLesson());
    await fixture.whenStable();

    rows[1]?.click();
    await fixture.whenStable();
    expect(host.querySelector(NOTE_FIELD)).toBeNull();
  });

  it('removes a note that was emptied', async () => {
    const host = await show(
      groupLesson({
        notes: [{ studentId: 's-1', note: 'Было', updatedAt: '2026-10-01T00:00:00Z' }],
      }),
    );
    host.querySelector<HTMLButtonElement>('.tb-lesson-summary__expand')?.click();
    await fixture.whenStable();
    const area = noteField(host);
    await type(area, '');
    await blur(area);
    const request = backend.expectOne('/api/teacher/schedule/lessons/gl-1/notes/s-1');
    expect(request.request.body).toEqual({ note: null });
    request.flush(groupLesson());
  });

  it('tells a failed save', async () => {
    const host = await show(scheduledLesson());
    const covered = field(host, 'Что прошли');
    await type(covered, 'Текст');
    await blur(covered);
    backend
      .expectOne('/api/teacher/schedule/lessons/l-1/summary')
      .flush({}, { status: 500, statusText: 'Server Error' });
    await fixture.whenStable();
    expect(host.textContent).toContain('Не удалось сохранить итоги');
  });

  it('sends the summary: disabled while empty, a snackbar after', async () => {
    const snackbar = TestBed.inject(Snackbar);
    const success = vi.spyOn(snackbar, 'success');
    const error = vi.spyOn(snackbar, 'error');
    const host = await show(scheduledLesson());
    expect(buttonByText(host, 'Отправить ученику').disabled).toBe(true);

    await show(scheduledLesson({ summary: 'Прошли Past Simple' }));
    buttonByText(host, 'Отправить ученику').click();
    backend.expectOne('/api/teacher/schedule/lessons/l-1/summary/share').flush(null);
    await fixture.whenStable();
    expect(success).toHaveBeenCalledWith('Итоги отправлены');

    buttonByText(host, 'Отправить ученику').click();
    backend
      .expectOne('/api/teacher/schedule/lessons/l-1/summary/share')
      .flush({}, { status: 500, statusText: 'Server Error' });
    await fixture.whenStable();
    expect(error).toHaveBeenCalledWith('Не удалось отправить итоги');
  });

  it('calls the button of a group «участникам»', async () => {
    const host = await show(groupLesson({ summary: 'Текст' }));
    expect(buttonByText(host, 'Отправить участникам').disabled).toBe(false);
  });
});
