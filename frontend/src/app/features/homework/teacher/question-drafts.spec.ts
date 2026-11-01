import { Question } from '../data-access/homework.models';
import {
  QuestionDraft,
  copyOf,
  firstProblem,
  moved,
  problemsOf,
  questionDraft,
  questionInputs,
  questionProblem,
  quizMinutes,
  retyped,
} from './question-drafts';

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
    expect(questionDraft('SHORT_TEXT').accepted).toEqual([]);
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

  it('change type keeping what fits and say when answers are lost', () => {
    const single = {
      ...questionDraft('SINGLE_CHOICE'),
      text: 'Q',
      points: 3,
      explanation: 'E',
      options: [
        { id: 'a', text: 'A', correct: true },
        { id: 'b', text: 'B', correct: false },
      ],
    };
    const many = retyped(single, 'MULTIPLE_CHOICE');
    expect(many.lossy).toBe(false);
    expect(many.draft).toMatchObject({
      type: 'MULTIPLE_CHOICE',
      id: single.id,
      text: 'Q',
      points: 3,
    });
    expect(many.draft.options).toEqual(single.options);
    const both = {
      ...many.draft,
      options: many.draft.options.map((o) => ({ ...o, correct: true })),
    };
    expect(retyped(both, 'SINGLE_CHOICE').draft.options.map((o) => o.correct)).toEqual([
      true,
      false,
    ]);
    const ordering = retyped(single, 'ORDERING');
    expect(ordering.draft.options.map((o) => [o.text, o.correct])).toEqual([
      ['A', false],
      ['B', false],
    ]);
    expect(retyped(single, 'NUMBER')).toMatchObject({
      lossy: true,
      draft: { type: 'NUMBER', text: 'Q' },
    });
    expect(retyped(questionDraft('SINGLE_CHOICE'), 'MATCHING').lossy).toBe(false);
    expect(retyped({ ...questionDraft('NUMBER'), value: 2 }, 'SHORT_TEXT').lossy).toBe(true);
    expect(retyped({ ...questionDraft('SHORT_TEXT'), accepted: ['x'] }, 'NUMBER').lossy).toBe(true);
    const pairs = { ...questionDraft('MATCHING'), pairs: [{ id: 'p', left: 'l', right: '' }] };
    expect(retyped(pairs, 'NUMBER').lossy).toBe(true);
  });

  it('copy a question with new ids', () => {
    const source = questionDraft('MATCHING');
    const copy = copyOf({ ...source, options: [{ id: 'o', text: 'x', correct: false }] });
    expect(copy.id).not.toBe(source.id);
    expect(copy.options[0]?.id).not.toBe('o');
    expect(copy.pairs.map((p) => p.id)).not.toEqual(source.pairs.map((p) => p.id));
  });

  it('list the broken questions by number and estimate the time', () => {
    const fine = { ...questionDraft('NUMBER'), text: 'Q', value: 1 };
    const broken = questionDraft('NUMBER');
    expect(problemsOf([fine, broken])).toEqual([
      { id: broken.id, number: 2, problem: 'Напишите текст вопроса' },
    ]);
    expect(quizMinutes(8)).toEqual([6, 8]);
    expect(quizMinutes(1)).toEqual([1, 2]);
    expect(moved([1, 2, 3], (n) => n === 3, 1)).toEqual([1, 2, 3]);
  });
});
