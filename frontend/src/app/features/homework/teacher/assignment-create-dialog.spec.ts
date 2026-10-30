import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { aiStatus } from '@testing/ai-fixtures';
import { aBoard } from '@testing/boards-fixtures';
import { buttonByText, readableText, typeInto } from '@testing/dom';
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

  function exactMenuItem(label: string): HTMLElement {
    const item = [...document.body.querySelectorAll<HTMLElement>('.p-menu-item-link')].find(
      (candidate) => candidate.textContent.trim() === label,
    );
    if (item === undefined) {
      throw new Error(`No menu item «${label}»`);
    }
    return item;
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

    click('Видео');
    await fixture.whenStable();

    expect(document.body.querySelector('section[aria-label="Материалы"]')).not.toBeNull();
    expect(document.body.querySelector('tb-video-section')).not.toBeNull();
    expect(readableText(document.body)).not.toContain('Фото');
  });

  it('adds no empty video section for a board', async () => {
    setup();
    await open();

    click('Доска');
    backend.expectOne('/api/teacher/boards').flush([aBoard()]);
    await fixture.whenStable();
    exactMenuItem('Алгебра').click();
    await fixture.whenStable();

    expect(document.body.querySelector('tb-video-section')).toBeNull();
    expect(document.body.querySelector('section[aria-label="Материалы"]')).toBeNull();
    expect(readableText(document.body)).toContain('Доска: Алгебра');
    expect(readableText(document.body)).not.toContain('Разместить на доске');

    document.body.querySelector<HTMLButtonElement>('tb-input-chip button')?.click();
    await fixture.whenStable();
    expect(readableText(document.body)).not.toContain('Доска: Алгебра');
    expect(buttonByText(document.body, 'Доска')).toBeTruthy();
  });

  it('says so when there are no boards to choose from', async () => {
    setup();
    await open();

    click('Доска');
    backend.expectOne('/api/teacher/boards').flush([]);
    await fixture.whenStable();

    expect(document.body.textContent).toContain('Досок пока нет');
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

  describe('AI pane', () => {
    const flushPrompts = async () => {
      await fixture.whenStable();
      for (const request of backend.match('/api/teacher/ai/prompts')) {
        request.flush([]);
      }
      await fixture.whenStable();
    };

    it('opens beside the form in one dialog and closes with the toggle or ×', async () => {
      setup();
      await open(true);
      const toggle = (): HTMLElement => exact('Написать с ИИ');
      expect(toggle().getAttribute('aria-pressed')).toBe('false');

      toggle().click();
      await flushPrompts();
      expect(toggle().getAttribute('aria-pressed')).toBe('true');
      expect(document.body.querySelector('.tb-d--split')).not.toBeNull();
      expect(document.body.querySelector('#create-text')).not.toBeNull();
      expect(readableText(document.body)).toContain('Текст задания');
      expect(readableText(document.body)).toContain('Вопросы теста');
      expect(document.body.querySelector('p-drawer')).toBeNull();

      document.body.querySelector<HTMLElement>('[aria-label="Закрыть помощника"]')?.click();
      await fixture.whenStable();
      expect(document.body.querySelector('.tb-create-ai')).toBeNull();
      expect(document.body.querySelector('.tb-d--split')).toBeNull();

      toggle().click();
      await flushPrompts();
      toggle().click();
      await fixture.whenStable();
      expect(document.body.querySelector('.tb-create-ai')).toBeNull();
    });

    it('takes the form’s place on a narrow screen and goes back with the arrow', async () => {
      setup(700);
      await open(true);
      exact('Написать с ИИ').click();
      await flushPrompts();
      expect(document.body.querySelector('#create-text')).toBeNull();
      expect(document.body.querySelector('.tb-d--split')).toBeNull();

      document.body.querySelector<HTMLElement>('[aria-label="Назад к заданию"]')?.click();
      await fixture.whenStable();
      expect(document.body.querySelector('#create-text')).not.toBeNull();
      expect(document.body.querySelector('.tb-create-ai')).toBeNull();
    });

    it('drafts variants, pages through them and inserts one into the text', async () => {
      setup();
      const dialog = await open(true);
      exact('Написать с ИИ').click();
      await flushPrompts();
      const generate = (title: string): void => {
        exact('Сгенерировать').click();
        backend
          .expectOne('/api/teacher/ai/homework-draft')
          .flush({ title, description: `Текст «${title}»` });
      };
      dialog.text.setValue('');
      const prompt = document.body.querySelector<HTMLTextAreaElement>('#ai-prompt');
      if (prompt === null) {
        throw new Error('no prompt');
      }
      typeInto(prompt, 'Времена');
      generate('Первый');
      await fixture.whenStable();
      expect(readableText(document.body)).toContain('вариант 1 из 1');

      exact('Ещё вариант').click();
      backend
        .expectOne('/api/teacher/ai/homework-draft')
        .flush({ title: 'Второй', description: 'B' });
      await fixture.whenStable();
      expect(readableText(document.body)).toContain('вариант 2 из 2');

      document.body.querySelector<HTMLElement>('[aria-label="Предыдущий вариант"]')?.click();
      await fixture.whenStable();
      expect(readableText(document.body)).toContain('вариант 1 из 2');
      expect(dialog.text.value).toBe('');

      exact('Вставить в задание').click();
      await fixture.whenStable();
      expect(dialog.text.value).toBe('Первый\n\nТекст «Первый»');
    });

    it('hands the drafted questions to the full editor', async () => {
      setup();
      const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
      await open(true);
      exact('Написать с ИИ').click();
      await flushPrompts();
      exact('Вопросы теста').click();
      await fixture.whenStable();
      const prompt = document.body.querySelector<HTMLTextAreaElement>('#ai-prompt');
      if (prompt === null) {
        throw new Error('no prompt');
      }
      typeInto(prompt, 'Пять вопросов');
      exact('Сгенерировать').click();
      const question = {
        id: 'q1',
        type: 'SHORT_TEXT',
        text: 'Вопрос',
        points: 1,
        explanation: null,
        options: [],
        correct: [],
        accepted: ['да'],
        value: null,
        tolerance: null,
        pairs: [],
      };
      backend.expectOne('/api/teacher/ai/quiz-draft').flush({ questions: [question] });
      await fixture.whenStable();
      exact('Добавить в тест').click();
      expect(navigate).toHaveBeenCalledWith(['/teacher/homework/new']);
      expect(TestBed.inject(AssignmentDraftHandover).take()?.questions).toHaveLength(1);
    });
  });
});
