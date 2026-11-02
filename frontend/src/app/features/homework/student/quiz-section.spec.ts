import type { MockInstance } from 'vitest';
import { BreakpointObserver, BreakpointState } from '@angular/cdk/layout';
import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BehaviorSubject } from 'rxjs';
import { Confirm } from '@shared/ui/confirm';
import { buttonByText, hostElement, readableText, requireElement, typeInto } from '@testing/dom';
import { testProviders } from '@testing/setup';
import {
  Question,
  QuizAttempt,
  QuizItem,
  QuizQuestion,
  QuizView,
} from '../data-access/homework.models';
import { QuizSection } from './quiz-section';

const URL = '/api/me/homework/tasks/t-1/quiz';
const ATTEMPT = '/api/me/homework/tasks/t-1/quiz/attempts';

function item(id: string, text: string): QuizItem {
  return { id, text };
}

function question(type: QuizQuestion['type'], overrides: Partial<QuizQuestion> = {}): QuizQuestion {
  return {
    id: `q-${type}`,
    type,
    text: `Вопрос ${type}`,
    points: 2,
    options: [],
    left: [],
    right: [],
    ...overrides,
  };
}

const QUESTIONS: QuizQuestion[] = [
  question('SINGLE_CHOICE', { options: [item('a', 'Красный'), item('b', 'Синий')] }),
  question('MULTIPLE_CHOICE', { options: [item('c', 'Один'), item('d', 'Два')] }),
  question('SHORT_TEXT'),
  question('NUMBER'),
  question('MATCHING', {
    left: [item('p1', 'Кот'), item('p2', 'Пёс')],
    right: [item('p2', 'Гав'), item('p1', 'Мяу')],
  }),
  question('ORDERING', { options: [item('o2', 'Второй'), item('o1', 'Первый')] }),
];

function attempt(overrides: Partial<QuizAttempt> = {}): QuizAttempt {
  return {
    id: 'at-1',
    startedAt: '2026-09-02T10:00:00Z',
    submittedAt: '2026-09-02T10:10:00Z',
    scorePoints: 4,
    maxPoints: 12,
    ...overrides,
  };
}

function quiz(overrides: Partial<QuizView> = {}): QuizView {
  return {
    questions: QUESTIONS,
    maxPoints: 12,
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

function key(overrides: Partial<Question>): Question {
  return {
    id: 'q',
    type: 'SINGLE_CHOICE',
    text: 'Текст',
    points: 2,
    explanation: null,
    options: [],
    correct: [],
    accepted: [],
    value: null,
    tolerance: null,
    pairs: [],
    ...overrides,
  };
}

describe('QuizSection', () => {
  let fixture: ComponentFixture<QuizSection>;
  let backend: HttpTestingController;
  let host: HTMLElement;
  let safe: MockInstance<Confirm['safe']>;
  const open = { id: 'at-1', startedAt: '', answers: {} };

  async function render(view: QuizView): Promise<void> {
    const phone = new BehaviorSubject<BreakpointState>({ matches: false, breakpoints: {} });
    TestBed.configureTestingModule({
      imports: [QuizSection],
      providers: testProviders({ provide: BreakpointObserver, useValue: { observe: () => phone } }),
    });
    backend = TestBed.inject(HttpTestingController);
    safe = vi.spyOn(TestBed.inject(Confirm), 'safe').mockResolvedValue(true);
    fixture = TestBed.createComponent(QuizSection);
    fixture.componentRef.setInput('taskId', 't-1');
    fixture.componentRef.setInput('title', 'Present Perfect');
    await fixture.whenStable();
    backend.expectOne(URL).flush(view);
    await fixture.whenStable();
    host = hostElement(fixture);
  }

  /** The full-screen test is appended to the body. */
  const screen = (): HTMLElement => document.body;

  async function next(): Promise<void> {
    buttonByText(screen(), 'Дальше').click();
    await fixture.whenStable();
  }

  afterEach(() => {
    fixture.destroy();
    backend.verify();
  });

  it('shows nothing when the assignment has no questions or the load failed', async () => {
    await render(quiz({ questions: [] }));
    expect(host.textContent.trim()).toBe('');
    expect(fixture.componentInstance.started()).toBe(false);
  });

  it('starts an attempt in the full-screen test', async () => {
    await render(quiz());
    const card = readableText(host);
    expect(card).toContain('Тест · 6 вопросов');
    expect(card).toContain('Осталось попыток: 2');
    expect(card).toContain('Правильные ответы покажем после сдачи.');
    buttonByText(host, 'Начать тест').click();
    backend.expectOne(ATTEMPT).flush(quiz({ openAttempt: open }));
    await fixture.whenStable();

    const text = readableText(screen());
    expect(text).toContain('Тест · Present Perfect');
    expect(text).toContain('Попытка 1 из 2 · ответы сохраняются сами');
    expect(text).toContain('Вопрос 1 из 6');
    expect(
      screen().querySelector('button[aria-label="Выйти из теста — ответы сохранятся"]'),
    ).not.toBeNull();
    expect(fixture.componentInstance.started()).toBe(true);
  });

  it('autosaves every type of answer, one question per screen', async () => {
    await render(quiz({ openAttempt: open }));
    buttonByText(host, 'Продолжить тест').click();
    await fixture.whenStable();
    const save = (id: string): unknown => {
      const request = backend.expectOne(`${ATTEMPT}/at-1/answers/${id}`);
      request.flush(null);
      return request.request.body;
    };

    screen().querySelector<HTMLInputElement>('#o-b')?.click();
    await fixture.whenStable();
    expect(save('q-SINGLE_CHOICE')).toEqual({ ids: ['b'] });
    await next();

    for (const [id, ids] of [
      ['c', ['c']],
      ['d', ['c', 'd']],
      ['c', ['d']],
    ] as const) {
      screen().querySelector<HTMLInputElement>(`#o-${id}`)?.click();
      await fixture.whenStable();
      expect(save('q-MULTIPLE_CHOICE')).toEqual({ ids });
    }
    await next();

    const text = requireElement(screen(), 'input[aria-label="Ответ"]', HTMLInputElement);
    typeInto(text, 'привет');
    text.dispatchEvent(new Event('blur'));
    await fixture.whenStable();
    expect(save('q-SHORT_TEXT')).toEqual({ text: 'привет' });
    await next();

    const number = requireElement(screen(), 'input[aria-label="Число"]', HTMLInputElement);
    typeInto(number, 'abc');
    typeInto(number, '2,5');
    // «Дальше» saves what is typed
    await next();
    expect(save('q-NUMBER')).toEqual({ number: 2.5 });
    await next();

    // ordering: the second item up, then back down
    buttonByText(screen(), 'Поднять выше: 2. Первый').click();
    await fixture.whenStable();
    expect(save('q-ORDERING')).toEqual({ ids: ['o1', 'o2'] });
    buttonByText(screen(), 'Опустить ниже: 1. Первый').click();
    await fixture.whenStable();
    expect(save('q-ORDERING')).toEqual({ ids: ['o2', 'o1'] });
  });

  it('saves typing after a pause', async () => {
    await render(quiz({ questions: [question('SHORT_TEXT')], openAttempt: open }));
    buttonByText(host, 'Продолжить тест').click();
    await fixture.whenStable();
    typeInto(requireElement(screen(), 'input[aria-label="Ответ"]', HTMLInputElement), 'да');
    backend.expectNone(`${ATTEMPT}/at-1/answers/q-SHORT_TEXT`);
    await new Promise((resolve) => setTimeout(resolve, 700));
    backend.expectOne(`${ATTEMPT}/at-1/answers/q-SHORT_TEXT`).flush(null);
  });

  it('finishes after the question about the skipped ones, saving what is still unsaved', async () => {
    await render(quiz({ openAttempt: open }));
    buttonByText(host, 'Продолжить тест').click();
    await fixture.whenStable();
    screen().querySelector<HTMLInputElement>('#o-a')?.click();
    await fixture.whenStable();

    buttonByText(screen(), 'Завершить тест').click();
    await fixture.whenStable();
    expect(String(safe.mock.calls[0]?.[0]?.message)).toMatch(/^Без ответа 4\s+вопроса/);
    // the submit waits for the answer that is still being saved
    backend.expectOne(`${ATTEMPT}/at-1/answers/q-SINGLE_CHOICE`).flush(null);
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
    backend.expectOne(`${ATTEMPT}/at-1/submit`).flush(
      quiz({
        attemptsUsed: 1,
        attemptsLeft: 1,
        attempts: [attempt()],
        best: attempt(),
        results: [
          {
            question: key({
              type: 'ORDERING',
              options: [item('o1', 'Первый'), item('o2', 'Второй')],
              explanation: 'Потому что так',
            }),
            answer: { ids: ['o2', 'o1'] },
            correct: false,
            points: 0,
          },
          {
            question: key({
              id: 'm',
              type: 'MATCHING',
              pairs: [{ id: 'p1', left: 'Кот', right: 'Мяу' }],
            }),
            answer: { pairs: { p1: 'p1' } },
            correct: true,
            points: 2,
          },
          {
            question: key({ id: 'n', type: 'NUMBER', value: 3, tolerance: 0.5 }),
            answer: null,
            correct: false,
            points: 0,
          },
          {
            question: key({ id: 't', type: 'SHORT_TEXT', accepted: ['да', 'ага'] }),
            answer: { text: 'нет' },
            correct: false,
            points: 0,
          },
          {
            question: key({
              id: 'c',
              type: 'MULTIPLE_CHOICE',
              options: [item('c', 'Один'), item('d', 'Два')],
              correct: ['c'],
            }),
            answer: { ids: ['d'] },
            correct: false,
            points: 0,
          },
        ],
      }),
    );
    await fixture.whenStable();

    expect(fixture.componentInstance.playing()).toBe(false);
    const text = readableText(host);
    expect(text).toContain('Тест · 4 из 12 4 ошибки');
    // only the mistakes: the right matching is not listed
    expect(text).not.toContain('Кот → Мяу');
    expect(text).toContain('Ваш ответ: 1. Второй, 2. Первый · Верный ответ: 1. Первый, 2. Второй');
    expect(text).toContain('Ваш ответ: нет ответа · Верный ответ: 3 ± 0.5');
    expect(text).toContain('Верный ответ: да, ага');
    expect(text).toContain('Потому что так');
    expect(host.querySelector('s')?.textContent).toBe('1. Второй, 2. Первый');
    expect(text).not.toContain('Правильные ответы покажем');
    expect(buttonByText(host, 'Пройти ещё раз')).toBeTruthy();
  });

  it('does not finish when the question is declined', async () => {
    await render(quiz({ openAttempt: open }));
    safe.mockResolvedValue(false);
    buttonByText(host, 'Продолжить тест').click();
    await fixture.whenStable();
    buttonByText(screen(), 'Завершить тест').click();
    await fixture.whenStable();
    backend.expectNone(`${ATTEMPT}/at-1/submit`);
  });

  it('saves what is typed when the test is closed', async () => {
    await render(quiz({ questions: [question('SHORT_TEXT')], openAttempt: open }));
    buttonByText(host, 'Продолжить тест').click();
    await fixture.whenStable();
    typeInto(requireElement(screen(), 'input[aria-label="Ответ"]', HTMLInputElement), 'да');
    buttonByText(screen(), 'Выйти из теста — ответы сохранятся').click();
    await fixture.whenStable();
    backend.expectOne(`${ATTEMPT}/at-1/answers/q-SHORT_TEXT`).flush(null);
    expect(fixture.componentInstance.playing()).toBe(false);
  });

  it('tells why the key is hidden and when no attempts are left', async () => {
    await render(
      quiz({
        reveal: 'AFTER_DUE',
        attemptsAllowed: 1,
        attemptsUsed: 1,
        attemptsLeft: 0,
        canStart: false,
        best: attempt(),
      }),
    );
    const text = readableText(host);
    expect(text).toBe('Тест · 4 из 12 Верные ответы появятся после срока сдачи.');
    // nothing left to do: no card with attempts and no button
    expect(host.querySelector('button')).toBeNull();
  });

  it('says once why the key is hidden while another attempt is left', async () => {
    await render(
      quiz({
        reveal: 'AFTER_DUE',
        attemptsAllowed: 2,
        attemptsUsed: 1,
        attemptsLeft: 1,
        canStart: true,
        best: attempt(),
      }),
    );
    expect(readableText(host).split('Верные ответы появятся после срока сдачи.')).toHaveLength(2);
  });

  it('tells the answers are never shown and that attempts are unlimited', async () => {
    await render(
      quiz({ reveal: 'NEVER', attemptsAllowed: null, attemptsLeft: null, best: attempt() }),
    );
    expect(readableText(host)).toContain('Учитель не показывает верные ответы.');
    expect(readableText(host)).toContain('Попыток сколько угодно');
  });

  it('keeps the answer to save again when saving fails', async () => {
    await render(quiz({ openAttempt: open }));
    buttonByText(host, 'Продолжить тест').click();
    await fixture.whenStable();
    screen().querySelector<HTMLInputElement>('#o-a')?.click();
    await fixture.whenStable();
    backend
      .expectOne(`${ATTEMPT}/at-1/answers/q-SINGLE_CHOICE`)
      .flush(null, { status: 500, statusText: 'Error' });
    await new Promise((resolve) => setTimeout(resolve));
    const retry = fixture.componentInstance.flush();
    backend.expectOne(`${ATTEMPT}/at-1/answers/q-SINGLE_CHOICE`).flush(null);
    await expect(retry).resolves.toBe(true);
  });

  it('shows an error when the attempt cannot be started', async () => {
    await render(quiz());
    buttonByText(host, 'Начать тест').click();
    backend
      .expectOne(ATTEMPT)
      .flush(
        { status: 422, code: 'homework.quiz-no-attempts-left' },
        { status: 422, statusText: 'Unprocessable' },
      );
    await fixture.whenStable();
    expect(fixture.componentInstance.view()?.openAttempt).toBeNull();
    expect(fixture.componentInstance.playing()).toBe(false);
  });
});
