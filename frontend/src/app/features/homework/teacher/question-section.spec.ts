import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  buttonByText,
  hostElement,
  menuItemByText,
  readableText,
  requireElement,
} from '@testing/dom';
import { testProviders } from '@testing/setup';
import { MAX_QUESTIONS, QuestionDraft, questionDraft } from './question-drafts';
import { QuestionSection } from './question-section';

function complete(text: string): QuestionDraft {
  return { ...questionDraft('NUMBER'), text, value: 1 };
}

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

  function texts(): string[] {
    return section.questions().map((q) => q.text);
  }

  function rows(): string[] {
    return [...host.querySelectorAll('.tb-qb__open')].map((row) => readableText(row));
  }

  it('adds a question of a type from the menu and opens it', async () => {
    buttonByText(host, 'Вопрос').click();
    await fixture.whenStable();
    expect(document.body.textContent).toContain('Один верный вариант из нескольких');
    menuItemByText('Соответствие').click();
    await fixture.whenStable();
    expect(section.questions().map((q) => q.type)).toEqual(['MATCHING']);
    expect(readableText(host)).toContain('1 вопрос · 1 балл');
    expect(host.querySelector('[aria-current="true"]')).not.toBeNull();
    expect(readableText(host)).toContain('Справа — верная пара');
  });

  it('opens a row, steps between questions and sums them up', async () => {
    section.questions.set([complete('Первый'), { ...complete('Второй'), points: 3 }, complete('')]);
    await fixture.whenStable();
    expect(rows()).toEqual(['1 Первый 1', '2 Второй 3', '3 Без текста 1']);
    expect(readableText(host)).toContain('Примерно займёт 2–3 мин');
    expect(readableText(host)).toContain('Вопрос 2');
    buttonByText(host, 'Вопрос 2').click();
    await fixture.whenStable();
    expect(requireElement(host, '[aria-current="true"]', HTMLElement).textContent).toContain(
      'Второй',
    );
    buttonByText(host, 'Вопрос 1').click();
    await fixture.whenStable();
    requireElement(
      host,
      '[data-row="' + (section.questions()[2]?.id ?? '') + '"]',
      HTMLElement,
    ).click();
    await fixture.whenStable();
    expect(host.querySelector('.tb-qb__steps')?.textContent).toContain('Вопрос 2');
  });

  it('copies, moves and removes the open question', async () => {
    section.questions.set([complete('A'), complete('B')]);
    await fixture.whenStable();
    buttonByText(host, 'Создать копию вопроса 1').click();
    await fixture.whenStable();
    expect(texts()).toEqual(['A', 'A', 'B']);
    expect(section.questions()[1]?.id).not.toBe(section.questions()[0]?.id);
    buttonByText(host, 'Вопрос 2 ниже').click();
    await fixture.whenStable();
    expect(texts()).toEqual(['A', 'B', 'A']);
    buttonByText(host, 'Убрать вопрос 3').click();
    await fixture.whenStable();
    expect(texts()).toEqual(['A', 'B']);
    expect(host.querySelector('[aria-current="true"]')?.textContent).toContain('B');
    buttonByText(host, 'Вопрос 2 выше').click();
    expect(texts()).toEqual(['B', 'A']);
  });

  it('reorders by the arrow keys on a handle and passes edits of the open question up', async () => {
    section.questions.set([complete('A'), complete('B')]);
    await fixture.whenStable();
    const first = section.questions()[0]?.id ?? '';
    requireElement(host, `[data-handle="${first}"]`, HTMLButtonElement).dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }),
    );
    expect(texts()).toEqual(['B', 'A']);
    section.replace({ ...complete('C'), id: first });
    expect(texts()).toEqual(['B', 'C']);
  });

  it('marks the broken questions once asked and opens the first one', async () => {
    section.questions.set([complete('A'), questionDraft('SHORT_TEXT')]);
    await fixture.whenStable();
    fixture.componentRef.setInput('showProblems', true);
    fixture.componentRef.setInput('error', 'Вопросы не сохранены');
    await fixture.whenStable();
    expect(readableText(host)).toContain('Вопросы не сохранены');
    expect(host.querySelectorAll('.tb-qb__row--broken')).toHaveLength(1);
    expect(readableText(host)).toContain('Вопрос 2: Напишите текст вопроса');
    expect(host.querySelector('[aria-current="true"]')?.textContent).toContain('2');
    buttonByText(host, 'Вопрос 1').click();
    await fixture.whenStable();
    requireElement(host, '[aria-label="Открыть вопрос 2"]', HTMLAnchorElement).click();
    await fixture.whenStable();
    expect(host.querySelector('[aria-current="true"]')?.textContent).toContain('2');
  });

  it('asks the assistant for questions', () => {
    const asked = vi.fn();
    section.ai.subscribe(asked);
    buttonByText(host, 'С ИИ').click();
    expect(asked).toHaveBeenCalled();
  });

  // Rendering 50 questions took 5.7 s on CI with coverage, over the default 5 s.
  it('hides the add buttons at the limit', async () => {
    section.questions.set(Array.from({ length: MAX_QUESTIONS }, () => questionDraft('NUMBER')));
    await fixture.whenStable();
    expect(host.querySelector('.tb-qb__add')).toBeNull();
    expect(
      host.querySelector('[aria-label="Создать копию вопроса 1"]')?.hasAttribute('disabled'),
    ).toBe(true);
  }, 20_000);

  it('is read-only once a student started the quiz', async () => {
    section.questions.set([complete('A')]);
    fixture.componentRef.setInput('locked', true);
    await fixture.whenStable();
    expect(host.querySelector('.tb-qb__add')).toBeNull();
    expect(host.querySelector('.tb-drag-handle')).toBeNull();
    expect(host.querySelector('[aria-label="Убрать вопрос 1"]')).toBeNull();
  });
});
