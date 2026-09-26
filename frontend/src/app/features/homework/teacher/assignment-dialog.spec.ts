import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { providePrimeNG } from 'primeng/config';
import { aiStatus } from '@testing/ai-fixtures';
import { assignmentDetails } from '@testing/homework-fixtures';
import { aGroup } from '@testing/identity-fixtures';
import { bodyText, buttonByText } from '@testing/dom';
import { AssignmentDetails } from '../data-access/homework.models';
import { AssignmentDialog } from './assignment-dialog';

describe('AssignmentDialog', () => {
  let fixture: ComponentFixture<AssignmentDialog>;
  let backend: HttpTestingController;
  let saved: AssignmentDetails[];

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [AssignmentDialog],
      providers: [provideHttpClient(), provideHttpClientTesting(), providePrimeNG()],
    });
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(AssignmentDialog);
    saved = [];
    fixture.componentInstance.saved.subscribe((value) => saved.push(value));
    fixture.componentRef.setInput('students', [
      { id: 's-1', displayName: 'Анна' },
      { id: 's-2', displayName: 'Борис' },
    ]);
  });

  afterEach(() => {
    backend.verify();
    fixture.destroy();
  });

  async function open(assignment: AssignmentDetails | null, aiEnabled = false): Promise<AssignmentDialog> {
    backend.match('/api/teacher/ai/status').forEach((request) => {
      request.flush(aiStatus({ enabled: aiEnabled }));
    });
    fixture.componentRef.setInput('assignment', assignment);
    fixture.componentRef.setInput('visible', true);
    await fixture.whenStable();
    backend.match('/api/teacher/groups').forEach((request) => {
      request.flush([aGroup({ members: [{ id: 's-2', displayName: 'Борис', status: 'ACTIVE' }] })]);
    });
    await fixture.whenStable();
    return fixture.componentInstance;
  }

  it('adds the students of a group', async () => {
    const dialog = await open(null);
    dialog.form.patchValue({ studentIds: ['s-1'] });

    dialog.addStudents(['s-2', 'unknown', 's-1']);

    expect(dialog.form.controls.studentIds.value).toEqual(['s-1', 's-2']);
  });

  it('creates an assignment for the chosen students', async () => {
    const dialog = await open(null);
    expect(bodyText()).toContain('Новое задание');
    expect(document.body.querySelector('#assignment-students')).not.toBeNull();

    dialog.form.patchValue({
      title: '  Дроби ',
      description: 'Решить **№1**',
      dueAt: new Date(Date.UTC(2026, 8, 10, 12, 0)),
      studentIds: ['s-1', 's-2'],
    });
    await fixture.whenStable();
    buttonByText(document.body, 'Выдать').click();

    const request = backend.expectOne('/api/teacher/homework/assignments');
    expect(request.request.body).toEqual({
      title: 'Дроби',
      description: 'Решить **№1**',
      dueAt: '2026-09-10T12:00:00.000Z',
      studentIds: ['s-1', 's-2'],
    });
    request.flush(assignmentDetails());
    await fixture.whenStable();

    expect(saved).toHaveLength(1);
    expect(dialog.visible()).toBe(false);
  });

  it('previews the description', async () => {
    const dialog = await open(null);
    dialog.form.controls.description.setValue('**важно**');
    dialog.mode.setValue('preview');
    await fixture.whenStable();

    expect(document.body.querySelector('.tb-preview strong')?.textContent).toBe('важно');
    expect(document.body.querySelector('#assignment-description')).toBeNull();
  });

  it('edits an existing assignment with its version', async () => {
    const dialog = await open(assignmentDetails({ version: 3, dueAt: null, description: null }));
    expect(bodyText()).toContain('Редактирование задания');
    expect(dialog.form.controls.title.value).toBe('Дроби');
    expect(document.body.querySelector('#assignment-students')).toBeNull();

    dialog.save();

    const request = backend.expectOne('/api/teacher/homework/assignments/a-1');
    expect(request.request.body).toEqual({ title: 'Дроби', description: null, dueAt: null, version: 3 });
    request.flush(assignmentDetails());
  });

  it('prefills the deadline when editing', async () => {
    const dialog = await open(assignmentDetails());

    expect(dialog.form.controls.dueAt.value?.toISOString()).toBe('2026-09-10T15:00:00.000Z');
  });

  it('shows errors and keeps the dialog open', async () => {
    const dialog = await open(null);
    dialog.form.patchValue({ title: 'x' });
    dialog.save();

    backend
      .expectOne('/api/teacher/homework/assignments')
      .flush({ status: 422, code: 'student.deactivated' }, { status: 422, statusText: 'Unprocessable' });
    await fixture.whenStable();

    expect(bodyText()).toContain('Нельзя выдать задание ученику с отключённым доступом');
    expect(dialog.visible()).toBe(true);
  });

  it('does not save without a title and closes on cancel', async () => {
    const dialog = await open(null);

    dialog.save();
    backend.expectNone('/api/teacher/homework/assignments');

    buttonByText(document.body, 'Отмена').click();
    expect(dialog.visible()).toBe(false);
  });

  it('hides the AI button when AI is off', async () => {
    await open(null);

    expect(bodyText()).not.toContain('Сгенерировать с ИИ');
  });

  it('puts an AI draft into the editor', async () => {
    const dialog = await open(null, true);
    dialog.form.controls.title.setValue('Дроби');
    await fixture.whenStable();

    buttonByText(document.body, 'Сгенерировать с ИИ').click();
    await fixture.whenStable();
    expect(bodyText()).toContain('Черновик задания с ИИ');

    dialog.applyDraft({ title: 'Сложение дробей', description: '1. **Сложите** 1/2 и 1/3' });
    await fixture.whenStable();

    expect(dialog.form.controls.title.value).toBe('Сложение дробей');
    expect(dialog.form.controls.description.value).toBe('1. **Сложите** 1/2 и 1/3');
    expect(dialog.mode.value).toBe('preview');
    expect(document.body.querySelector('.tb-preview strong')?.textContent).toBe('Сложите');
  });
});
