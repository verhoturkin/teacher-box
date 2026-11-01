import { Question, QuestionType } from '../data-access/homework.models';
import { T } from '../i18n/texts';

/** An option, an item of an ordering, being written in the editor. */
export interface OptionDraft {
  readonly id: string;
  readonly text: string;
  /** A right choice; unused by an ordering. */
  readonly correct: boolean;
}

/** A pair of a matching being written in the editor. */
export interface PairDraft {
  readonly id: string;
  readonly left: string;
  readonly right: string;
}

/** A question being written in the editor; the fields of other types stay empty. */
export interface QuestionDraft {
  readonly id: string;
  readonly type: QuestionType;
  readonly text: string;
  readonly points: number;
  readonly explanation: string;
  readonly options: readonly OptionDraft[];
  readonly accepted: readonly string[];
  readonly value: number | null;
  readonly tolerance: number | null;
  readonly pairs: readonly PairDraft[];
}

/** The limits of the backend (`Quiz`, `Question`, `ShortText`). */
export const MAX_QUESTIONS = 50;
export const MAX_ITEMS = 10;
export const MAX_ACCEPTED = 10;
export const MIN_ITEMS = 2;
export const MAX_POINTS = 100;

export const QUESTION_TYPES: readonly QuestionType[] = [
  'SINGLE_CHOICE',
  'MULTIPLE_CHOICE',
  'SHORT_TEXT',
  'NUMBER',
  'MATCHING',
  'ORDERING',
];

/** The icon of each question type (sketch 28). */
export const QUESTION_ICONS: Readonly<Record<QuestionType, string>> = {
  SINGLE_CHOICE: 'tb-i-radio_button_checked',
  MULTIPLE_CHOICE: 'tb-i-check_box',
  SHORT_TEXT: 'tb-i-short_text',
  NUMBER: 'tb-i-pin',
  MATCHING: 'tb-i-compare_arrows',
  ORDERING: 'tb-i-format_list_numbered',
};

function newId(): string {
  return crypto.randomUUID();
}

export function option(text = '', correct = false): OptionDraft {
  return { id: newId(), text, correct };
}

export function pair(): PairDraft {
  return { id: newId(), left: '', right: '' };
}

/** A new question of the type, with the blanks it needs, or the draft of a saved one. */
export function questionDraft(type: QuestionType, saved?: Question): QuestionDraft {
  if (saved !== undefined) {
    return {
      id: saved.id,
      type: saved.type,
      text: saved.text,
      points: saved.points,
      explanation: saved.explanation ?? '',
      options: saved.options.map((item) => ({
        id: item.id,
        text: item.text,
        correct: saved.correct.includes(item.id),
      })),
      accepted: saved.accepted,
      value: saved.value,
      tolerance: saved.tolerance,
      pairs: saved.pairs,
    };
  }
  const choice = type === 'SINGLE_CHOICE' || type === 'MULTIPLE_CHOICE';
  return {
    id: newId(),
    type,
    text: '',
    points: 1,
    explanation: '',
    options: choice || type === 'ORDERING' ? [option('', type === 'SINGLE_CHOICE'), option()] : [],
    accepted: [],
    value: null,
    tolerance: type === 'NUMBER' ? 0 : null,
    pairs: type === 'MATCHING' ? [pair(), pair()] : [],
  };
}

/** The questions to save, trimmed, with only the fields of their type. */
export function questionInputs(drafts: readonly QuestionDraft[]): Question[] {
  return drafts.map((draft) => {
    const choice = draft.type === 'SINGLE_CHOICE' || draft.type === 'MULTIPLE_CHOICE';
    const options =
      choice || draft.type === 'ORDERING'
        ? draft.options.map((item) => ({ id: item.id, text: item.text.trim() }))
        : [];
    return {
      id: draft.id,
      type: draft.type,
      text: draft.text.trim(),
      points: draft.points,
      explanation: draft.explanation.trim() === '' ? null : draft.explanation.trim(),
      options,
      correct: choice ? draft.options.filter((item) => item.correct).map((item) => item.id) : [],
      accepted:
        draft.type === 'SHORT_TEXT'
          ? draft.accepted.map((answer) => answer.trim()).filter((answer) => answer !== '')
          : [],
      value: draft.type === 'NUMBER' ? draft.value : null,
      tolerance: draft.type === 'NUMBER' ? (draft.tolerance ?? 0) : null,
      pairs:
        draft.type === 'MATCHING'
          ? draft.pairs.map((item) => ({
              id: item.id,
              left: item.left.trim(),
              right: item.right.trim(),
            }))
          : [],
    };
  });
}

/** What is wrong with the question, in words, or `null`. */
export function questionProblem(draft: QuestionDraft): string | null {
  const p = T.quiz.problems;
  if (draft.text.trim() === '') {
    return p.text;
  }
  if (draft.points < 1 || draft.points > MAX_POINTS) {
    return p.points;
  }
  const filled = draft.options.filter((item) => item.text.trim() !== '');
  const marked = draft.options.filter((item) => item.correct).length;
  switch (draft.type) {
    case 'SINGLE_CHOICE':
    case 'MULTIPLE_CHOICE':
      if (filled.length < MIN_ITEMS || filled.length !== draft.options.length) {
        return p.options;
      }
      if (draft.type === 'SINGLE_CHOICE' ? marked !== 1 : marked === 0) {
        return draft.type === 'SINGLE_CHOICE' ? p.correct : p.correctMany;
      }
      return null;
    case 'ORDERING':
      return filled.length < MIN_ITEMS || filled.length !== draft.options.length ? p.items : null;
    case 'SHORT_TEXT':
      return draft.accepted.some((answer) => answer.trim() !== '') ? null : p.accepted;
    case 'NUMBER':
      if (draft.value === null) {
        return p.value;
      }
      return (draft.tolerance ?? 0) < 0 ? p.tolerance : null;
    case 'MATCHING':
      return draft.pairs.length >= MIN_ITEMS &&
        draft.pairs.every((item) => item.left.trim() !== '' && item.right.trim() !== '')
        ? null
        : p.pairs;
  }
}

/** The first question that cannot be saved; `null` — all are fine. */
export function firstProblem(drafts: readonly QuestionDraft[]): string | null {
  for (const draft of drafts) {
    const problem = questionProblem(draft);
    if (problem !== null) {
      return problem;
    }
  }
  return null;
}

/** The list with the matching item one place earlier or later; at the edge — unchanged. */
export function moved<A>(
  list: readonly A[],
  match: (item: A) => boolean,
  step: -1 | 1,
): readonly A[] {
  const from = list.findIndex(match);
  const to = from + step;
  const item = list[from];
  const other = list[to];
  if (item === undefined || other === undefined) {
    return list;
  }
  return list.map((entry, position) => {
    if (position === from) {
      return other;
    }
    return position === to ? item : entry;
  });
}

/** The kinds that keep a list of options: they pass it to each other on a change of type. */
function listed(type: QuestionType): boolean {
  return type === 'SINGLE_CHOICE' || type === 'MULTIPLE_CHOICE' || type === 'ORDERING';
}

/**
 * The question as another type (sketch 29): the text, points and explanation stay; the options pass
 * between the choices and the ordering (a single choice keeps only its first right option, the
 * ordering none); `lossy` — answers of the old type are dropped.
 */
export function retyped(
  draft: QuestionDraft,
  type: QuestionType,
): { draft: QuestionDraft; lossy: boolean } {
  const kept = {
    ...questionDraft(type),
    id: draft.id,
    text: draft.text,
    points: draft.points,
    explanation: draft.explanation,
  };
  if (listed(draft.type) && listed(type)) {
    const first = draft.options.find((item) => item.correct)?.id;
    const options = draft.options.map((item) => {
      if (type === 'ORDERING' || draft.type === 'ORDERING') {
        return { ...item, correct: false };
      }
      return type === 'SINGLE_CHOICE' ? { ...item, correct: item.id === first } : item;
    });
    return { draft: { ...kept, options }, lossy: false };
  }
  const lossy =
    draft.options.some((item) => item.text.trim() !== '') ||
    draft.accepted.some((answer) => answer.trim() !== '') ||
    draft.value !== null ||
    draft.pairs.some((item) => item.left.trim() !== '' || item.right.trim() !== '');
  return { draft: kept, lossy };
}

/** A copy of the question with new ids (the ids of options must be unique in the quiz). */
export function copyOf(draft: QuestionDraft): QuestionDraft {
  const options = draft.options.map((item) => ({ ...item, id: newId() }));
  const pairs = draft.pairs.map((item) => ({ ...item, id: newId() }));
  return { ...draft, id: newId(), options, pairs };
}

/** Each question that cannot be given out: its number from 1 and what is wrong. */
export function problemsOf(
  drafts: readonly QuestionDraft[],
): { id: string; number: number; problem: string }[] {
  return drafts.flatMap((draft, index) => {
    const problem = questionProblem(draft);
    return problem === null ? [] : [{ id: draft.id, number: index + 1, problem }];
  });
}

/**
 * «Примерно займёт»: from three quarters of a minute to a minute a question (ours — the sketch shows
 * 6–8 min for 8 questions; M3 says nothing).
 */
export function quizMinutes(count: number): [number, number] {
  const from = Math.max(1, Math.round(count * 0.75));
  return [from, Math.max(from + 1, count)];
}
