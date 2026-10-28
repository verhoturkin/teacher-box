import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Question } from '../data-access/homework.models';
import { buttonByText, hostElement, readableText, requireElement, typeInto } from '@testing/dom';
import { testProviders } from '@testing/setup';
import {
  MAX_QUESTIONS,
  QuestionDraft,
  QuestionSection,
  firstProblem,
  questionDraft,
  questionInputs,
  questionProblem,
} from './question-section';

function saved(overrides: Partial<Question>): Question {
  return {
    id: 'q-1',
    type: 'SINGLE_CHOICE',
    text: 'Столица?',
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

function filled(draft: QuestionDraft): QuestionDraft {
  return { ...draft, text: 'Вопрос' };
}

describe('question drafts', () => {
  it('start with the blanks their type needs', () => {
    expect(questionDraft('SINGLE_CHOICE').options.map((o) => o.correct)).toEqual([true, false]);
    expect(questionDraft('MULTIPLE_CHOICE').options.map((o) => o.correct)).toEqual([false, false]);
    expect(questionDraft('ORDERING').options).toHaveLength(2);
    expect(questionDraft('SHORT_TEXT').accepted).toEqual(['']);
    expect(questionDraft('NUMBER').tolerance).toBe(0);
    expect(questionDraft('MATCHING').pairs).toHaveLength(2);
  });

  it('turn a saved question into a draft and back, keeping the ids', () => {
    const question = saved({
      options: [
        { id: 'o-1', text: 'Москва' },
        { id: 'o-2', text: 'Тверь' },
      ],
      correct: ['o-1'],
      explanation: 'Столица — Москва',
    });
    const draft = questionDraft(question.type, question);
    expect(draft.options.map((o) => o.correct)).toEqual([true, false]);
    expect(questionInputs([draft])).toEqual([question]);
  });

  it('are sent trimmed with only the fields of their type', () => {
    const short = { ...questionDraft('SHORT_TEXT'), text: ' Q ', accepted: [' да ', ' '] };
    const number = { ...questionDraft('NUMBER'), text: 'Q', value: 3, tolerance: null };
    const matching = {
      ...questionDraft('MATCHING'),
      text: 'Q',
      pairs: [{ id: 'p-1', left: ' a ', right: ' b ' }],
    };
    const [a, b, c] = questionInputs([short, number, matching]);
    expect(a).toMatchObject({ text: 'Q', accepted: ['да'], options: [], value: null, pairs: [] });
    expect(b).toMatchObject({ value: 3, tolerance: 0, accepted: [] });
    expect(c?.pairs).toEqual([{ id: 'p-1', left: 'a', right: 'b' }]);
  });

  it('say what is wrong with each type', () => {
    const single = filled(questionDraft('SINGLE_CHOICE'));
    expect(questionProblem({ ...single, text: ' ' })).toBe('Напишите текст вопроса');
    expect(questionProblem({ ...single, points: 0 })).toBe('Баллы — от 1 до 100');
    expect(questionProblem(single)).toBe('Нужно не меньше двух вариантов с текстом');
    const options = single.options.map((o, i) => ({ ...o, text: `v${String(i)}` }));
    expect(questionProblem({ ...single, options })).toBeNull();
    expect(
      questionProblem({ ...single, options: options.map((o) => ({ ...o, correct: false })) }),
    ).toBe('Отметьте верный вариант');
    const multiple = filled(questionDraft('MULTIPLE_CHOICE'));
    expect(
      questionProblem({ ...multiple, options: options.map((o) => ({ ...o, correct: false })) }),
    ).toBe('Отметьте хотя бы один верный вариант');
    expect(
      questionProblem({ ...multiple, options: options.map((o) => ({ ...o, correct: true })) }),
    ).toBeNull();
    const ordering = filled(questionDraft('ORDERING'));
    expect(questionProblem(ordering)).toBe('Нужно не меньше двух элементов с текстом');
    expect(questionProblem({ ...ordering, options })).toBeNull();
    const short = filled(questionDraft('SHORT_TEXT'));
    expect(questionProblem(short)).toBe('Нужен хотя бы один ответ');
    expect(questionProblem({ ...short, accepted: ['да'] })).toBeNull();
    const number = filled(questionDraft('NUMBER'));
    expect(questionProblem(number)).toBe('Укажите число');
    expect(questionProblem({ ...number, value: 1, tolerance: -1 })).toBe(
      'Допуск не может быть отрицательным',
    );
    expect(questionProblem({ ...number, value: 1, tolerance: null })).toBeNull();
    const matching = filled(questionDraft('MATCHING'));
    expect(questionProblem(matching)).toBe('Нужно не меньше двух пар с обеими частями');
    const pairs = matching.pairs.map((p) => ({ ...p, left: 'a', right: 'b' }));
    expect(questionProblem({ ...matching, pairs })).toBeNull();
    expect(firstProblem([{ ...matching, pairs }, short])).toBe('Нужен хотя бы один ответ');
    expect(firstProblem([])).toBeNull();
  });
});

describe('QuestionSection', () => {
  let fixture: ComponentFixture<QuestionSection>;
  let section: QuestionSection;
  let host: HTMLElement;

  beforeEach(async () => {
    TestBed.configureTestingModule({ imports: [QuestionSection], providers: testProviders() });
    fixture = TestBed.createComponent(QuestionSection);
    section = fixture.componentInstance;
    host = hostElement(fixture);
    await fixture.whenStable();
  });

  function types(): string[] {
    return section.questions().map((q) => q.type);
  }

  function idOf(index: number): string {
    return section.questions()[index]?.id ?? '';
  }

  it('adds a question of each type from its button and shows the total', async () => {
    for (const label of [
      'Один ответ',
      'Несколько ответов',
      'Короткий ответ',
      'Число',
      'Соответствие',
      'Порядок',
    ]) {
      buttonByText(host, label).click();
      await fixture.whenStable();
    }
    expect(types()).toEqual([
      'SINGLE_CHOICE',
      'MULTIPLE_CHOICE',
      'SHORT_TEXT',
      'NUMBER',
      'MATCHING',
      'ORDERING',
    ]);
    expect(readableText(host)).toContain('Вопросов: 6, баллов: 6');
    expect(readableText(host)).toContain('Сразу после сдачи теста');
    expect(readableText(host)).toContain('1 попытка');
  });

  it('edits the text, points and explanation of a question', async () => {
    section.add('SINGLE_CHOICE');
    await fixture.whenStable();
    typeInto(requireElement(host, 'textarea', HTMLTextAreaElement), 'Столица?');
    section.change(idOf(0), { points: 3, explanation: 'Москва' });
    await fixture.whenStable();
    expect(section.questions()[0]).toMatchObject({
      text: 'Столица?',
      points: 3,
      explanation: 'Москва',
    });
  });

  it('works the options of a single choice: one right at a time, add, remove', async () => {
    section.add('SINGLE_CHOICE');
    const second = section.questions()[0]?.options[1]?.id ?? '';
    section.pick(idOf(0), second);
    expect(section.questions()[0]?.options.map((o) => o.correct)).toEqual([false, true]);
    section.addOption(idOf(0));
    section.changeOption(idOf(0), second, { text: 'Тверь' });
    expect(section.questions()[0]?.options).toHaveLength(3);
    await fixture.whenStable();
    buttonByText(host, 'Убрать вариант 3').click();
    expect(section.questions()[0]?.options).toHaveLength(2);
  });

  it('moves questions and the items of an ordering, never past the ends', () => {
    section.add('SINGLE_CHOICE');
    section.add('ORDERING');
    const [single, ordering] = [idOf(0), idOf(1)];
    section.move(ordering, -1);
    expect(types()).toEqual(['ORDERING', 'SINGLE_CHOICE']);
    section.move(ordering, -1);
    section.move(single, 1);
    expect(types()).toEqual(['ORDERING', 'SINGLE_CHOICE']);
    const first = section.questions()[0]?.options[0]?.id ?? '';
    section.moveOption(ordering, first, 1);
    expect(section.questions()[0]?.options[1]?.id).toBe(first);
    section.moveOption(ordering, first, 1);
    expect(section.questions()[0]?.options[1]?.id).toBe(first);
    section.remove(single);
    expect(types()).toEqual(['ORDERING']);
  });

  it('works the answers of a short text and the pairs of a matching', () => {
    section.add('SHORT_TEXT');
    section.add('MATCHING');
    section.addAnswer(idOf(0));
    section.changeAnswer(idOf(0), 1, 'ответ');
    section.removeAnswer(idOf(0), 0);
    expect(section.questions()[0]?.accepted).toEqual(['ответ']);
    section.addPair(idOf(1));
    const pair = section.questions()[1]?.pairs[2]?.id ?? '';
    section.changePair(idOf(1), pair, { left: 'a', right: 'b' });
    expect(section.questions()[1]?.pairs[2]).toMatchObject({ left: 'a', right: 'b' });
    section.removePair(idOf(1), pair);
    expect(section.questions()[1]?.pairs).toHaveLength(2);
  });

  it('shows what is wrong once asked, the server error and no add buttons at the limit', async () => {
    section.add('SHORT_TEXT');
    fixture.componentRef.setInput('showProblems', true);
    fixture.componentRef.setInput('error', 'Вопросы не сохранены');
    await fixture.whenStable();
    expect(readableText(host)).toContain('Напишите текст вопроса');
    expect(readableText(host)).toContain('Вопросы не сохранены');

    section.questions.set(Array.from({ length: MAX_QUESTIONS }, () => questionDraft('NUMBER')));
    await fixture.whenStable();
    expect(host.querySelector('.tb-question-types')).toBeNull();
  });

  it('is read-only once a student started the quiz', async () => {
    section.add('MULTIPLE_CHOICE');
    fixture.componentRef.setInput('locked', true);
    await fixture.whenStable();
    expect(readableText(host)).toContain('Ученик уже начал тест');
    expect(host.querySelector('.tb-question-types')).toBeNull();
    expect(host.querySelector('textarea')?.disabled).toBe(true);
    expect(host.querySelector('[aria-label="Убрать вопрос 1"]')).toBeNull();
  });

  it('offers the attempts it was given even when they are not in the list', async () => {
    section.add('NUMBER');
    section.attempts.set(4);
    await fixture.whenStable();
    expect(readableText(host)).toContain('4 попытки');
    section.attempts.set(0);
    await fixture.whenStable();
    expect(readableText(host)).toContain('Без ограничений');
  });
});
