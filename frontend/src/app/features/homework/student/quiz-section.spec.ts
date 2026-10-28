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
  let phone: BehaviorSubject<BreakpointState>;

  async function render(view: QuizView, compact = false): Promise<void> {
    phone = new BehaviorSubject<BreakpointState>({ matches: compact, breakpoints: {} });
    TestBed.configureTestingModule({
      imports: [QuizSection],
      providers: testProviders({ provide: BreakpointObserver, useValue: { observe: () => phone } }),
    });
    backend = TestBed.inject(HttpTestingController);
    vi.spyOn(TestBed.inject(Confirm), 'safe').mockResolvedValue(true);
    fixture = TestBed.createComponent(QuizSection);
    fixture.componentRef.setInput('taskId', 't-1');
    await fixture.whenStable();
    backend.expectOne(URL).flush(view);
    await fixture.whenStable();
    host = hostElement(fixture);
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

  it('starts an attempt and lists all questions on a wide screen', async () => {
    await render(quiz());
    expect(readableText(host)).toContain('Осталось попыток: 2');
    buttonByText(host, 'Начать тест').click();
    backend
      .expectOne(ATTEMPT)
      .flush(quiz({ openAttempt: { id: 'at-1', startedAt: '', answers: {} } }));
    await fixture.whenStable();

    expect(host.querySelectorAll('article')).toHaveLength(6);
    expect(readableText(host)).toContain('Ответы сохраняются автоматически');
    expect(fixture.componentInstance.started()).toBe(true);
  });

  it('autosaves every type of answer', async () => {
    await render(quiz({ openAttempt: { id: 'at-1', startedAt: '', answers: {} } }));
    const save = (id: string): { body: unknown } => {
      const request = backend.expectOne(`${ATTEMPT}/at-1/answers/${id}`);
      request.flush(null);
      return { body: request.request.body };
    };

    host.querySelector<HTMLInputElement>('#o-b')?.click();
    await fixture.whenStable();
    expect(save('q-SINGLE_CHOICE').body).toEqual({ ids: ['b'] });

    for (const [id, ids] of [
      ['c', ['c']],
      ['d', ['c', 'd']],
      ['c', ['d']],
    ] as const) {
      host.querySelector<HTMLInputElement>(`#o-${id}`)?.click();
      await fixture.whenStable();
      expect(save('q-MULTIPLE_CHOICE').body).toEqual({ ids });
    }

    const text = requireElement(host, 'input[aria-label="Ответ"]', HTMLInputElement);
    const number = requireElement(host, 'input[aria-label="Число"]', HTMLInputElement);
    typeInto(text, 'привет');
    text.dispatchEvent(new Event('blur'));
    await fixture.whenStable();
    expect(save('q-SHORT_TEXT').body).toEqual({ text: 'привет' });

    typeInto(number, 'abc');
    typeInto(number, '2,5');
    number.dispatchEvent(new Event('blur'));
    await fixture.whenStable();
    expect(save('q-NUMBER').body).toEqual({ number: 2.5 });

    // ordering: the second item up, then back down
    buttonByText(host, 'Поднять выше: 2. Первый').click();
    await fixture.whenStable();
    expect(save('q-ORDERING').body).toEqual({ ids: ['o1', 'o2'] });
    buttonByText(host, 'Опустить ниже: 1. Первый').click();
    await fixture.whenStable();
    expect(save('q-ORDERING').body).toEqual({ ids: ['o2', 'o1'] });
  });

  it('saves a matching pair', async () => {
    await render(quiz({ openAttempt: { id: 'at-1', startedAt: '', answers: {} } }));
    const matching = QUESTIONS.find((q) => q.type === 'MATCHING');
    if (matching === undefined) {
      throw new Error('no matching question');
    }
    fixture.componentInstance.setPair(matching, 'p1', 'p1');
    await fixture.whenStable();
    const request = backend.expectOne(`${ATTEMPT}/at-1/answers/q-MATCHING`);
    expect(request.request.body).toEqual({ pairs: { p1: 'p1' } });
    request.flush(null);
  });

  it('shows one question per screen on a phone and keeps the saved answers', async () => {
    await render(
      quiz({
        openAttempt: { id: 'at-1', startedAt: '', answers: { 'q-SINGLE_CHOICE': { ids: ['a'] } } },
      }),
      true,
    );
    expect(host.querySelectorAll('article')).toHaveLength(1);
    expect(readableText(host)).toContain('Вопрос 1 из 6');
    expect(host.querySelector<HTMLInputElement>('#o-a')?.checked).toBe(true);

    buttonByText(host, 'Далее').click();
    await fixture.whenStable();
    expect(readableText(host)).toContain('Вопрос 2 из 6');
    buttonByText(host, 'Назад').click();
    await fixture.whenStable();
    expect(readableText(host)).toContain('Вопрос 1 из 6');
  });

  it('submits after the confirmation, saving what is still unsaved', async () => {
    await render(quiz({ openAttempt: { id: 'at-1', startedAt: '', answers: {} } }));
    host.querySelector<HTMLInputElement>('#o-a')?.click();
    await fixture.whenStable();

    buttonByText(host, 'Сдать тест').click();
    await fixture.whenStable();
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

    const text = readableText(host);
    expect(text).toContain('Лучший результат: 4 из 12');
    expect(text).toContain('Верно · 2 б.');
    expect(text).toContain('Неверно · 0 б.');
    expect(text).toContain('Кот → Мяу');
    expect(text).toContain('1. Первый');
    expect(text).toContain('3 ± 0.5');
    expect(text).toContain('да ага');
    expect(text).toContain('нет ответа');
    expect(text).toContain('Потому что так');
    expect(buttonByText(host, 'Пройти ещё раз')).toBeTruthy();
  });

  it('does not submit when the confirmation is declined', async () => {
    await render(quiz({ openAttempt: { id: 'at-1', startedAt: '', answers: {} } }));
    vi.spyOn(TestBed.inject(Confirm), 'safe').mockResolvedValue(false);
    buttonByText(host, 'Сдать тест').click();
    await fixture.whenStable();
    backend.expectNone(`${ATTEMPT}/at-1/submit`);
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
    expect(text).toContain('Верные ответы появятся после срока сдачи.');
    expect(text).toContain('Осталось попыток: 0');
    expect(host.querySelector('button')).toBeNull();
  });

  it('tells the answers are never shown and that attempts are unlimited', async () => {
    await render(
      quiz({ reveal: 'NEVER', attemptsAllowed: null, attemptsLeft: null, best: attempt() }),
    );
    expect(readableText(host)).toContain('Учитель не показывает верные ответы.');
    expect(readableText(host)).toContain('Попыток сколько угодно');
  });

  it('keeps the answer to save again when saving fails', async () => {
    await render(quiz({ openAttempt: { id: 'at-1', startedAt: '', answers: {} } }));
    host.querySelector<HTMLInputElement>('#o-a')?.click();
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
  });
});
