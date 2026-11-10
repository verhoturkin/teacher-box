import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Location } from '@angular/common';
import { MessageService } from 'primeng/api';
import { assignmentDetails } from '@testing/homework-fixtures';
import { buttonByText, hostElement, readableText } from '@testing/dom';
import { HomeworkAiState } from '@features/ai/parts';
import { screenWidth, testProviders } from '@testing/setup';
import {
  EDITOR_STUDENTS,
  UNSTARTED,
  exactButton,
  useEditorHarness,
} from '@testing/homework-editor';
import { AssignmentEditorPage } from '../assignment-editor-page';
import { questionDraft } from '../question-drafts';

describe('AssignmentEditorPage: «Тест»', () => {
  const editor = useEditorHarness();

  it('keeps the test on its own tab and sums it up on «Задание»', async () => {
    const { page, host } = await editor.create([], true);
    const tabs = () =>
      [...host.querySelectorAll('[role="tab"]')].map((tab) =>
        tab.textContent.trim().replace(/\s+/g, ' '),
      );
    const state = editor.fixture.debugElement.injector.get(HomeworkAiState);
    expect(tabs()).toEqual(['Задание', 'Тест']);
    expect(host.querySelector('#editor-quiz-summary')).toBeNull();

    page.changeQuestions([
      { ...questionDraft('NUMBER'), text: 'Сколько?', value: 1, points: 2 },
      questionDraft('SHORT_TEXT'),
      { ...questionDraft('MATCHING'), text: 'Пары' },
      { ...questionDraft('ORDERING'), text: 'Порядок' },
    ]);
    page.changeAttempts(2);
    await editor.fixture.whenStable();
    expect(tabs()).toEqual(['Задание', 'Тест · 4 вопроса']);
    const summary = readableText(
      host.querySelector<HTMLElement>('#editor-quiz-summary') ?? host,
    ).replace(/\s+/g, ' ');
    expect(summary).toContain('4 вопроса · 5 баллов · 2 попытки');
    expect(summary).toContain('Сколько?');
    expect(summary).toContain('Без текста');
    expect(summary).not.toContain('Порядок');
    expect(summary).toContain('…и ещё 1 вопрос');
    expect(state.mode()).toBe('TASK');

    buttonByText(host, 'Открыть тест').click();
    await editor.fixture.whenStable();
    expect(host.querySelector('tb-question-section')).not.toBeNull();
    expect(host.querySelector('tb-quiz-settings')).not.toBeNull();
    expect(state.mode()).toBe('QUESTIONS');

    page.choose('task');
    await editor.fixture.whenStable();
    expect(TestBed.inject(Location).path()).not.toContain('tab=');
    expect(host.querySelector('#editor-text')).not.toBeNull();
  });

  it('splits the test into «Вопросы» and «Настройки» on a phone', async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: testProviders(screenWidth(500)) });
    editor.backend = TestBed.inject(HttpTestingController);
    editor.fixture = TestBed.createComponent(AssignmentEditorPage);
    editor.fixture.componentRef.setInput('tab', 'settings');
    await editor.fixture.whenStable();
    editor.backend.expectOne('/api/teacher/students').flush(EDITOR_STUDENTS);
    editor.backend
      .expectOne((request) => request.url === '/api/teacher/schedule/lessons')
      .flush([]);
    editor.flushStatus(false);
    editor.flushGroups();
    await editor.fixture.whenStable();
    const host = hostElement(editor.fixture);

    expect([...host.querySelectorAll('[role="tab"]')].map((tab) => tab.textContent.trim())).toEqual(
      ['Задание', 'Вопросы', 'Настройки'],
    );
    expect(host.querySelector('tb-quiz-settings')).not.toBeNull();
    expect(host.querySelector('tb-question-section')).toBeNull();
    editor.fixture.componentInstance.choose('quiz');
    await editor.fixture.whenStable();
    expect(host.querySelector('tb-question-section')).not.toBeNull();
    expect(host.querySelector('tb-quiz-settings')).toBeNull();
  });

  it('gives a saved draft out and names the questions to fix', async () => {
    const { host } = await editor.edit(
      assignmentDetails({ tasks: [], draftStudentIds: ['s-1'], attachments: [] }),
    );
    editor.backend.expectOne('/api/teacher/students').flush(EDITOR_STUDENTS);
    editor.flushGroups();
    await editor.fixture.whenStable();

    exactButton(host, 'Выдать').click();
    editor.backend
      .expectOne({ method: 'PUT', url: '/api/teacher/homework/assignments/a-1' })
      .flush(assignmentDetails({ tasks: [], version: 1 }));
    editor.backend.expectOne('/api/teacher/homework/assignments/a-1/students').flush(
      {
        status: 422,
        code: 'homework.quiz-incomplete',
        questions: [
          { number: 2, code: 'homework.quiz-text-invalid' },
          { number: 3, code: 'homework.quiz-no-correct' },
        ],
      },
      { status: 422, statusText: 'Unprocessable' },
    );
    editor.backend
      .expectOne('/api/teacher/homework/assignments/a-1')
      .flush(assignmentDetails({ tasks: [], version: 2 }));
    await editor.fixture.whenStable();
    expect(readableText(host)).toContain('Задание не выдано: поправьте вопросы 2, 3');
    expect(host.querySelector('tb-question-section')).not.toBeNull();

    exactButton(host, 'Выдать').click();
    const again = editor.backend.expectOne({
      method: 'PUT',
      url: '/api/teacher/homework/assignments/a-1',
    });
    expect(again.request.body).toMatchObject({ version: 2 });
    again.flush(assignmentDetails({ tasks: [], version: 3 }));
    editor.backend
      .expectOne('/api/teacher/homework/assignments/a-1/students')
      .flush(assignmentDetails({ version: 3 }));
    await editor.fixture.whenStable();
    expect(TestBed.inject(MessageService).add).toHaveBeenCalledWith(
      expect.objectContaining({ detail: 'Задание выдано' }),
    );
    expect(editor.navigate).toHaveBeenCalledWith(['/teacher/homework', 'a-1']);
  });

  it('saves the questions and the quiz settings, sending nothing when the quiz is untouched', async () => {
    const { page, host } = await editor.edit(
      assignmentDetails({ attachments: [], tasks: UNSTARTED }),
    );
    exactButton(host, 'Сохранить').click();
    const plain = editor.backend.expectOne({
      method: 'PUT',
      url: '/api/teacher/homework/assignments/a-1',
    });
    expect(plain.request.body).not.toHaveProperty('questions');
    expect(plain.request.body).not.toHaveProperty('quizReveal');
    plain.flush(assignmentDetails({ version: 1 }));
    await editor.fixture.whenStable();

    const again = await editor.edit(assignmentDetails({ attachments: [], tasks: UNSTARTED }));
    expect(again.page.canLeave()).toBe(true);
    again.page.changeQuestions([
      { ...questionDraft('NUMBER'), text: 'Сколько будет 2 + 2?', value: 4 },
    ]);
    again.page.changeReveal('NEVER');
    again.page.changeAttempts(0);
    expect(again.page.canLeave()).not.toBe(true);
    exactButton(again.host, 'Сохранить').click();
    const put = editor.backend.expectOne({
      method: 'PUT',
      url: '/api/teacher/homework/assignments/a-1',
    });
    expect(put.request.body).toMatchObject({
      questions: [{ type: 'NUMBER', text: 'Сколько будет 2 + 2?', value: 4, tolerance: 0 }],
      quizReveal: 'NEVER',
      quizAttempts: 0,
    });
    put.flush(assignmentDetails({ version: 1 }));
    expect(page).toBeTruthy();
  });

  it('shows the saved questions and holds the save while a question is incomplete', async () => {
    const { page, host } = await editor.edit(
      assignmentDetails({
        attachments: [],
        tasks: UNSTARTED,
        questions: [
          {
            id: 'q-1',
            type: 'SHORT_TEXT',
            text: 'Столица России?',
            points: 1,
            explanation: null,
            options: [],
            correct: [],
            accepted: ['Москва'],
            value: null,
            tolerance: null,
            pairs: [],
          },
        ],
        quizAttempts: null,
      }),
    );
    page.choose('quiz');
    await editor.fixture.whenStable();
    expect(host.querySelector<HTMLTextAreaElement>('#question-text-q-1')?.value).toBe(
      'Столица России?',
    );
    expect(readableText(host)).toContain('Без огр.');

    page.changeQuestions([...page.questions(), questionDraft('SINGLE_CHOICE')]);
    exactButton(host, 'Сохранить').click();
    await editor.fixture.whenStable();
    editor.backend.expectNone({ method: 'PUT', url: '/api/teacher/homework/assignments/a-1' });
    expect(readableText(host)).toContain('Напишите текст вопроса');
  });

  it('shows the test as the student sees it without saving the answers', async () => {
    const { page, host } = await editor.edit(
      assignmentDetails({
        attachments: [],
        tasks: UNSTARTED,
        questions: [
          {
            id: 'q-1',
            type: 'SINGLE_CHOICE',
            text: 'Столица России?',
            points: 1,
            explanation: null,
            options: [
              { id: 'o-1', text: 'Москва' },
              { id: 'o-2', text: 'Казань' },
            ],
            correct: ['o-1'],
            accepted: [],
            value: null,
            tolerance: null,
            pairs: [],
          },
        ],
      }),
    );
    expect(host.querySelector('button[aria-label="Как увидит ученик"]')).toBeNull();
    page.choose('quiz');
    await editor.fixture.whenStable();
    exactButton(host, 'Как увидит ученик').click();
    await editor.fixture.whenStable();

    const text = readableText(document.body);
    expect(text).toContain('Так тест увидит ученик · ответы не сохраняются');
    expect(text).toContain('Вопрос 1 из 1');
    document.body.querySelector<HTMLInputElement>('#o-o-1')?.click();
    await editor.fixture.whenStable();
    exactButton(document.body, 'Завершить тест').click();
    await editor.fixture.whenStable();
    editor.backend.expectNone((request) => request.url.includes('/quiz'));
    expect(document.body.querySelector('button[aria-label="Закрыть просмотр"]')).toBeNull();
  });

  it('locks the questions when a student has started the quiz and saves the rest', async () => {
    const { page, host } = await editor.edit(assignmentDetails({ attachments: [] }));
    page.choose('quiz');
    page.changeQuestions([{ ...questionDraft('NUMBER'), text: 'Вопрос', value: 1 }]);
    await editor.fixture.whenStable();
    exactButton(host, 'Сохранить').click();
    editor.backend
      .expectOne({ method: 'PUT', url: '/api/teacher/homework/assignments/a-1' })
      .flush(
        { status: 422, code: 'homework.quiz-started' },
        { status: 422, statusText: 'Unprocessable' },
      );
    await editor.fixture.whenStable();
    expect(readableText(host)).toContain('Ученик уже начал тест: вопросы изменить нельзя');
    expect(page.questions()).toEqual([]);

    exactButton(host, 'Сохранить').click();
    const retry = editor.backend.expectOne({
      method: 'PUT',
      url: '/api/teacher/homework/assignments/a-1',
    });
    expect(retry.request.body).not.toHaveProperty('questions');
    retry.flush(assignmentDetails({ version: 1 }));
  });

  it('locks a quiz a student finished and edits a copy of it on «Тест»', async () => {
    const { page, host } = await editor.edit(assignmentDetails({ attachments: [] }));
    page.choose('quiz');
    await editor.fixture.whenStable();
    expect(readableText(host)).toContain('Ученик уже начал тест');
    exactButton(host, 'Создать копию для правок').click();
    editor.backend
      .expectOne({ method: 'POST', url: '/api/teacher/homework/assignments/a-1/copy' })
      .flush(assignmentDetails({ id: 'a-2', title: 'Копия', tasks: [] }));
    expect(editor.navigate).toHaveBeenCalledWith(['/teacher/homework', 'a-2', 'edit'], {
      queryParams: { tab: 'quiz' },
    });

    editor.fixture.componentRef.setInput('assignmentId', 'a-2');
    await editor.fixture.whenStable();
    editor.backend
      .expectOne('/api/teacher/homework/assignments/a-2')
      .flush(assignmentDetails({ id: 'a-2', tasks: [], draftStudentIds: [] }));
    editor.backend.expectOne('/api/teacher/students').flush(EDITOR_STUDENTS);
    editor.flushGroups();
    await editor.fixture.whenStable();
    expect(readableText(host)).not.toContain('Ученик уже начал тест');
  });

  it('reports a copy that failed', async () => {
    const { page, host } = await editor.edit(assignmentDetails({ attachments: [] }));
    page.choose('quiz');
    await editor.fixture.whenStable();
    exactButton(host, 'Создать копию для правок').click();
    editor.backend
      .expectOne({ method: 'POST', url: '/api/teacher/homework/assignments/a-1/copy' })
      .flush({ status: 500 }, { status: 500, statusText: 'Error' });
    await editor.fixture.whenStable();
    expect(editor.navigate).not.toHaveBeenCalled();
  });
});
