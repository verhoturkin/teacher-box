import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { aiStatus } from '@testing/ai-fixtures';
import { buttonByText, readableText } from '@testing/dom';
import { assignmentDetails } from '@testing/homework-fixtures';
import { scheduledLesson } from '@testing/schedule-fixtures';
import { screenWidth, testProviders } from '@testing/setup';
import { AssignmentCreateDialog } from './assignment-create-dialog';
import { AssignmentDraftHandover, titleOf } from './assignment-draft';

const ASSIGNMENTS = '/api/teacher/homework/assignments';
const STUDENTS = [{ id: 's-1', displayName: 'Анна', status: 'ACTIVE' }].map((student) => ({
  ...student,
  avatar: null,
  email: null,
  phone: null,
  note: null,
  login: null,
  createdAt: '2026-09-01T10:00:00Z',
  version: 0,
  pendingInvite: null,
}));

describe('titleOf', () => {
  it('takes the first non-empty line without Markdown marks', () => {
    expect(titleOf('\n\n## **Present** [Perfect](http://x.y) `4–7`\nтекст')).toBe(
      'Present Perfect 4–7',
    );
    expect(titleOf('- пункт')).toBe('пункт');
    expect(titleOf('   \n')).toBe('');
    expect(titleOf('a'.repeat(300))).toHaveLength(200);
  });
});

describe('AssignmentCreateDialog', () => {
  let backend: HttpTestingController;
  let fixture: ComponentFixture<AssignmentCreateDialog>;

  function setup(width = 1700): void {
    TestBed.configureTestingModule({ providers: testProviders(screenWidth(width)) });
    backend = TestBed.inject(HttpTestingController);
    vi.spyOn(TestBed.inject(MessageService), 'add');
  }

  function nextLesson() {
    const starts = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
    starts.setSeconds(0, 0);
    return scheduledLesson({
      studentId: 's-1',
      participants: [
        { studentId: 's-1', studentName: null, studentAvatar: null, attendance: 'EXPECTED' },
      ],
      startsAt: starts.toISOString(),
    });
  }

  async function open(ai = false, lessons = [nextLesson()]) {
    fixture = TestBed.createComponent(AssignmentCreateDialog);
    fixture.componentRef.setInput('visible', true);
    await fixture.whenStable();
    for (const request of backend.match('/api/teacher/ai/status')) {
      request.flush(aiStatus({ enabled: ai }));
    }
    backend.expectOne('/api/teacher/students').flush(STUDENTS);
    for (const request of backend.match((r) => r.url.startsWith('/api/teacher/groups'))) {
      request.flush([]);
    }
    backend.expectOne((request) => request.url === '/api/teacher/schedule/lessons').flush(lessons);
    await fixture.whenStable();
    return fixture.componentInstance;
  }

  /** The dialog lives in the body, not in the fixture. */
  function click(text: string): void {
    buttonByText(document.body, text).click();
  }

  function exact(text: string): HTMLButtonElement {
    const button = [...document.body.querySelectorAll('button')].find(
      (candidate) => candidate.textContent.trim() === text,
    );
    if (button === undefined) {
      throw new Error(`Button "${text}" not found`);
    }
    return button;
  }

  afterEach(() => {
    fixture.destroy();
    vi.restoreAllMocks();
  });

  it('offers the next lesson, a week, no deadline and a date; the lesson chip hides without a lesson', async () => {
    setup();
    const dialog = await open();
    dialog.members.setValue([{ kind: 'STUDENT', id: 's-1' }]);
    await fixture.whenStable();

    const text = readableText(document.body);
    expect(text).toContain('К следующему занятию');
    expect(text).toContain('Через неделю');
    expect(text).toContain('Без срока');
    expect(text).toContain('Дата…');

    dialog.members.setValue([]);
    await fixture.whenStable();
    expect(readableText(document.body)).not.toContain('К следующему занятию');
  });

  it('shows the materials only once something is added', async () => {
    setup();
    await open();
    expect(document.body.querySelector('section[aria-label="Материалы"]')).toBeNull();

    click('Доска');
    await fixture.whenStable();

    expect(document.body.querySelector('section[aria-label="Материалы"]')).not.toBeNull();
    expect(readableText(document.body)).toContain('Разместить на доске');
    expect(readableText(document.body)).not.toContain('Фото');
  });

  it('hides «Написать с ИИ» without AI', async () => {
    setup();
    await open(false);
    expect(readableText(document.body)).not.toContain('Написать с ИИ');
  });

  it('shows «Написать с ИИ» with AI', async () => {
    setup();
    await open(true);
    expect(readableText(document.body)).toContain('Написать с ИИ');
  });

  it('needs a recipient and a text before giving out', async () => {
    setup();
    const dialog = await open();

    exact('Выдать').click();
    await fixture.whenStable();
    expect(readableText(document.body)).toContain('Выберите, кому выдать задание');

    dialog.members.setValue([{ kind: 'STUDENT', id: 's-1' }]);
    exact('Выдать').click();
    await fixture.whenStable();
    expect(readableText(document.body)).toContain('Напишите текст задания');
    backend.expectNone(ASSIGNMENTS);
  });

  it('gives out: the title is the first line, the lesson is the deadline', async () => {
    setup();
    const lesson = nextLesson();
    const dialog = await open(false, [lesson]);
    dialog.members.setValue([{ kind: 'STUDENT', id: 's-1' }]);
    dialog.text.setValue('# Дроби\nРешите №1');
    await fixture.whenStable();

    exact('Выдать').click();
    const created = backend.expectOne({ method: 'POST', url: ASSIGNMENTS });
    expect(created.request.body).toMatchObject({
      title: 'Дроби',
      description: '# Дроби\nРешите №1',
      dueAt: lesson.startsAt,
      videos: [],
    });
    created.flush(assignmentDetails({ id: 'a-9', tasks: [] }));
    await fixture.whenStable();
    const assigned = backend.expectOne(`${ASSIGNMENTS}/a-9/students`);
    expect(assigned.request.body).toEqual({ studentIds: ['s-1'] });
    assigned.flush(assignmentDetails({ id: 'a-9' }));
    await fixture.whenStable();

    expect(dialog.visible()).toBe(false);
  });

  it('saves a draft without recipients and without giving out', async () => {
    setup();
    const dialog = await open();
    dialog.text.setValue('Дроби');
    click('Без срока');
    await fixture.whenStable();

    click('Сохранить черновик');
    const created = backend.expectOne({ method: 'POST', url: ASSIGNMENTS });
    expect(created.request.body).toMatchObject({ title: 'Дроби', dueAt: null });
    created.flush(assignmentDetails({ id: 'a-9', tasks: [] }));
    await fixture.whenStable();

    backend.expectNone(`${ASSIGNMENTS}/a-9/students`);
    expect(dialog.visible()).toBe(false);
  });

  it('keeps the chosen recipients with the draft, still giving it to nobody', async () => {
    setup();
    const dialog = await open();
    dialog.text.setValue('Дроби');
    dialog.members.setValue([{ kind: 'STUDENT', id: 's-1' }]);

    click('Сохранить черновик');
    backend
      .expectOne({ method: 'POST', url: ASSIGNMENTS })
      .flush(assignmentDetails({ id: 'a-9', tasks: [] }));
    await fixture.whenStable();

    const kept = backend.expectOne({ method: 'PUT', url: `${ASSIGNMENTS}/a-9/draft-students` });
    expect(kept.request.body).toEqual({ studentIds: ['s-1'] });
    kept.flush(assignmentDetails({ id: 'a-9', tasks: [], draftStudentIds: ['s-1'] }));
    backend.expectNone(`${ASSIGNMENTS}/a-9/students`);
  });

  it('shows the chosen ones as input chips and removes one with «×»', async () => {
    setup();
    const dialog = await open();
    dialog.members.setValue([{ kind: 'STUDENT', id: 's-1' }]);
    await fixture.whenStable();

    expect(document.body.querySelector('tb-input-chip')?.textContent).toContain('Анна');
    expect(readableText(document.body)).toContain('Ученик или группа');

    click('Убрать: Анна');
    await fixture.whenStable();

    expect(dialog.members.value).toEqual([]);
    expect(document.body.querySelector('tb-input-chip')).toBeNull();
  });

  it('hands everything to the full editor', async () => {
    setup();
    const dialog = await open();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    dialog.text.setValue('Дроби');
    dialog.members.setValue([{ kind: 'STUDENT', id: 's-1' }]);

    click('Открыть во весь экран');

    expect(navigate).toHaveBeenCalledWith(['/teacher/homework/new']);
    const handover = TestBed.inject(AssignmentDraftHandover);
    expect(handover.take()).toMatchObject({
      text: 'Дроби',
      members: [{ kind: 'STUDENT', id: 's-1' }],
    });
    expect(handover.take()).toBeNull();
  });

  it('on a phone: «Фото», «Выдать» in the top bar and no split button', async () => {
    setup(390);
    await open();

    const text = readableText(document.body);
    expect(text).toContain('Фото');
    expect(text).toContain('Сохранить черновик');
    expect(document.body.querySelector('.tb-split')).toBeNull();
    expect(document.body.querySelector('.tb-d__head')?.textContent).toContain('Выдать');
  });
});
