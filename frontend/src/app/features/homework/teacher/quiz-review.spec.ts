import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { aiStatus } from '@testing/ai-fixtures';
import { buttonByText, hostElement, readableText } from '@testing/dom';
import { assignmentDetails, taskDetails } from '@testing/homework-fixtures';
import { testProviders } from '@testing/setup';
import { Question, QuizReview, ReviewResult } from '../data-access/homework.models';
import { AssignmentPage } from './assignment-page';
import { TaskReviewPage } from './task-review-page';

function question(overrides: Partial<Question>): Question {
  return {
    id: 'q-1',
    type: 'SINGLE_CHOICE',
    text: 'Столица?',
    points: 1,
    explanation: null,
    options: [
      { id: 'o-1', text: 'Москва' },
      { id: 'o-2', text: 'Тверь' },
    ],
    correct: ['o-1'],
    accepted: [],
    value: null,
    tolerance: null,
    pairs: [],
    ...overrides,
  };
}

function result(overrides: Partial<ReviewResult>): ReviewResult {
  return {
    question: question({}),
    answer: { ids: ['o-1'] },
    correct: true,
    points: 1,
    overridden: false,
    ...overrides,
  };
}

function quiz(results: ReviewResult[], suggestedGrade: string | null = '1 из 2'): QuizReview {
  return {
    maxPoints: 2,
    attemptsUsed: 2,
    suggestedGrade,
    best: {
      id: 'at-1',
      startedAt: '2026-09-05T09:00:00Z',
      submittedAt: '2026-09-05T10:00:00Z',
      scorePoints: 1,
      maxPoints: 2,
    },
    results,
  };
}

const WRONG = result({
  question: question({ id: 'q-2', text: 'Число?', type: 'NUMBER', value: 4, tolerance: 0.5 }),
  answer: { number: 5 },
  correct: false,
  points: 0,
});

describe('quiz in the task review', () => {
  async function render(review: QuizReview | null) {
    TestBed.configureTestingModule({ providers: testProviders() });
    const backend = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(TaskReviewPage);
    fixture.componentRef.setInput('taskId', 't-1');
    backend.expectOne('/api/teacher/ai/status').flush(aiStatus({ enabled: false }));
    await fixture.whenStable();
    backend.expectOne('/api/teacher/homework/tasks/t-1').flush(taskDetails({ quiz: review }));
    await fixture.whenStable();
    return { backend, fixture, host: hostElement(fixture) };
  }

  it('shows the score, the wrong answers first with the key, and suggests the grade', async () => {
    const { fixture, host } = await render(quiz([result({}), WRONG]));

    expect(host.querySelector('.tb-qr__label')?.textContent.trim()).toBe('Тест: 1 из 2');
    const titles = [...host.querySelectorAll('.tb-qr-card__title')].map((h) => h.textContent);
    expect(titles).toEqual(['Вопрос 2', 'Вопрос 1']);
    const first = readableText(host.querySelector('.tb-qr-card')!);
    expect(first).toContain('Неверно · 0 из 1 б.');
    expect(first).toContain('Ответ ученика 5');
    expect(first).toContain('Верный ответ 4 ± 0.5');
    expect(fixture.componentInstance.form.controls.grade.value).toBe('1 из 2');
  });

  it('says so when nothing is submitted and shows no block without questions', async () => {
    const empty = { ...quiz([]), best: null, suggestedGrade: null };
    const { host } = await render(empty);
    expect(host.querySelector('.tb-qr__label')?.textContent.trim()).toBe(
      'Тест: ученик ещё не сдал',
    );
    expect(host.querySelector('.tb-qr-card')).toBeNull();
  });

  it('shows a blank answer and changes a verdict; the grade follows unless typed', async () => {
    const blank = { ...WRONG, answer: null };
    const { backend, fixture, host } = await render(quiz([result({}), blank]));
    expect(readableText(host.querySelector('.tb-qr-card')!)).toContain('нет ответа');

    buttonByText(host, 'Засчитать').click();
    const request = backend.expectOne('/api/teacher/homework/tasks/t-1/quiz/answers/q-2');
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({ correct: true });
    request.flush(
      taskDetails({
        quiz: {
          ...quiz([result({}), { ...blank, correct: true, points: 1, overridden: true }], '2 из 2'),
        },
      }),
    );
    await fixture.whenStable();

    expect(host.textContent).toContain('вы изменили');
    expect(fixture.componentInstance.form.controls.grade.value).toBe('2 из 2');

    fixture.componentInstance.form.controls.grade.setValue('5');
    buttonByText(host, 'Не засчитывать').click();
    backend
      .expectOne('/api/teacher/homework/tasks/t-1/quiz/answers/q-1')
      .flush(taskDetails({ quiz: quiz([], '1 из 2') }));
    await fixture.whenStable();
    expect(fixture.componentInstance.form.controls.grade.value).toBe('5');
  });

  it('keeps the block when the override fails', async () => {
    const { backend, fixture, host } = await render(quiz([WRONG]));
    buttonByText(host, 'Засчитать').click();
    backend
      .expectOne('/api/teacher/homework/tasks/t-1/quiz/answers/q-2')
      .flush(null, { status: 500, statusText: 'Error' });
    await fixture.whenStable();
    expect(host.querySelectorAll('.tb-qr-card')).toHaveLength(1);
  });
});

describe('quiz stats on the assignment page', () => {
  async function render(questions: Question[], stats: object) {
    TestBed.configureTestingModule({ providers: testProviders() });
    const backend = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(AssignmentPage);
    fixture.componentRef.setInput('assignmentId', 'a-1');
    await fixture.whenStable();
    backend
      .expectOne('/api/teacher/homework/assignments/a-1')
      .flush(assignmentDetails({ questions }));
    await fixture.whenStable();
    if (questions.length > 0) {
      backend.expectOne('/api/teacher/homework/assignments/a-1/quiz/stats').flush(stats);
      await fixture.whenStable();
    }
    return { backend, host: hostElement(fixture) };
  }

  it('lists the wrong answers per question', async () => {
    const { host } = await render([question({})], {
      students: 4,
      questions: [{ questionId: 'q-1', text: 'Столица **России**?', wrong: 3 }],
    });
    const row = host.querySelector('.tb-asg-stats__row')!;
    expect(readableText(row)).toBe('1 3 из 4');
    expect(row.getAttribute('title')).toBe('Столица России?');
    expect(row.querySelector<HTMLElement>('.tb-asg-stats__bar > span')?.style.inlineSize).toBe(
      '75%',
    );
  });

  it('says nobody has submitted yet', async () => {
    const { host } = await render([question({})], { students: 0, questions: [] });
    expect(host.textContent).toContain('Пока никто не сдал тест');
  });

  it('asks for no stats without questions', async () => {
    const { backend, host } = await render([], {});
    expect(host.querySelector('.tb-asg-stats')).toBeNull();
    backend.verify();
  });
});
