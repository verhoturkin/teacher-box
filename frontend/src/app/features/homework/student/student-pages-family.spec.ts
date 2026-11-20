import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { CHILD_ID, familyScopeOf } from '@testing/family-fixtures';
import { hostElement, readableText } from '@testing/dom';
import { myTask, taskDetails } from '@testing/homework-fixtures';
import { testProviders } from '@testing/setup';
import { QuizView } from '../data-access/homework.models';
import { MyHomeworkPage } from './my-homework-page';
import { MyTaskPage } from './my-task-page';
import { QuizSection } from './quiz-section';

const BASE = `/api/guardian/students/${CHILD_ID}/homework`;

function configure(): HttpTestingController {
  TestBed.configureTestingModule({ providers: [...testProviders(), familyScopeOf()] });
  return TestBed.inject(HttpTestingController);
}

function quiz(overrides: Partial<QuizView> = {}): QuizView {
  return {
    questions: [
      { id: 'q', type: 'SHORT_TEXT', text: 'Вопрос', points: 1, options: [], left: [], right: [] },
    ],
    maxPoints: 1,
    reveal: 'AFTER_SUBMIT',
    attemptsAllowed: 2,
    attemptsUsed: 0,
    attemptsLeft: 2,
    canStart: true,
    openAttempt: null,
    attempts: [],
    best: null,
    results: null,
    ...overrides,
  };
}

describe('homework of a child in the family cabinet', () => {
  it('lists the child’s tasks with links into the family cabinet', async () => {
    const backend = configure();
    const fixture = TestBed.createComponent(MyHomeworkPage);
    await fixture.whenStable();
    backend.expectOne(BASE).flush([myTask({ taskId: 't-7', title: 'Дроби' })]);
    await fixture.whenStable();

    expect(
      hostElement(fixture).querySelector(`a[href="/family/${CHILD_ID}/homework/t-7"]`),
    ).not.toBeNull();
    expect(readableText(hostElement(fixture))).toContain(
      'Здесь откроется задание с ответами ребёнка',
    );
    backend.verify();
  });

  it('shows the task, the answers and the comment without the answer form or the board', async () => {
    const backend = configure();
    const fixture = TestBed.createComponent(MyTaskPage);
    fixture.componentRef.setInput('taskId', 't-1');
    fixture.componentRef.setInput('single', true);
    await fixture.whenStable();
    backend.expectOne(`${BASE}/tasks/t-1`).flush(
      taskDetails({
        status: 'RETURNED',
        teacherComment: 'Добавь упражнение 3',
        assignment: { ...taskDetails().assignment, boardId: 'b-1' },
      }),
    );
    await fixture.whenStable();
    backend.expectOne(`${BASE}/tasks/t-1/quiz`).flush(quiz({ questions: [] }));
    await fixture.whenStable();

    const host = hostElement(fixture);
    const text = readableText(host);
    expect(text).toContain('Добавь упражнение 3');
    expect(host.querySelector('textarea')).toBeNull();
    expect(
      Array.from(host.querySelectorAll('button'), (button) => button.textContent.trim()),
    ).not.toContain('Сдать снова');
    expect(host.querySelector('tb-my-board-button')).toBeNull();
    expect(host.querySelector(`a[href="/family/${CHILD_ID}/homework"]`)).not.toBeNull();
    backend.expectNone('/api/me/boards');
    backend.verify();
  });

  it('names the handed-in answers «Ответ» and leads to the next task of the child', async () => {
    const backend = configure();
    const fixture = TestBed.createComponent(MyTaskPage);
    fixture.componentRef.setInput('taskId', 't-1');
    fixture.componentRef.setInput('next', 't-2');
    await fixture.whenStable();
    backend.expectOne(`${BASE}/tasks/t-1`).flush(taskDetails({ status: 'ACCEPTED', grade: '5' }));
    await fixture.whenStable();
    backend.expectOne(`${BASE}/tasks/t-1/quiz`).flush(quiz({ questions: [] }));
    await fixture.whenStable();

    const host = hostElement(fixture);
    expect(readableText(host)).toContain('Ответ');
    expect(readableText(host)).not.toContain('Мой ответ');
    expect(host.querySelector(`a[href="/family/${CHILD_ID}/homework/t-2"]`)).not.toBeNull();
    backend.verify();
  });

  it('shows the test card without «Начать тест» and no player for an open attempt', async () => {
    const backend = configure();
    const fixture = TestBed.createComponent(QuizSection);
    fixture.componentRef.setInput('taskId', 't-1');
    await fixture.whenStable();
    backend
      .expectOne(`${BASE}/tasks/t-1/quiz`)
      .flush(quiz({ openAttempt: { id: 'at-1', startedAt: '2026-09-02T10:00:00Z', answers: {} } }));
    await fixture.whenStable();

    const host = hostElement(fixture);
    expect(readableText(host)).toContain('Тест');
    expect(host.querySelector('p-button')).toBeNull();
    expect(host.querySelector('tb-quiz-player')).toBeNull();
    backend.verify();
  });
});
