import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Confirm } from '@shared/ui/confirm';
import {
  buttonByText,
  hostElement,
  menuItemByText,
  readableText,
  requireElement,
  typeInto,
} from '@testing/dom';
import { testProviders } from '@testing/setup';
import { QuestionDraft, questionDraft } from './question-drafts';
import { QuestionEditor, arrowStep, reordered } from './question-editor';

describe('QuestionEditor', () => {
  let fixture: ComponentFixture<QuestionEditor>;
  let editor: QuestionEditor;
  let host: HTMLElement;
  const danger = vi.fn<() => Promise<boolean>>();

  async function show(draft: QuestionDraft): Promise<void> {
    fixture.componentRef.setInput('question', draft);
    await fixture.whenStable();
  }

  function question(): QuestionDraft {
    return editor.question();
  }

  function key(target: Element, name: string): void {
    target.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true }));
  }

  beforeEach(() => {
    danger.mockReset();
    TestBed.configureTestingModule({
      imports: [QuestionEditor],
      providers: [...testProviders(), { provide: Confirm, useValue: { danger } }],
    });
    fixture = TestBed.createComponent(QuestionEditor);
    editor = fixture.componentInstance;
    host = hostElement(fixture);
    fixture.componentRef.setInput('number', 3);
  });

  it('edits the text, the points and the explanation folded while empty', async () => {
    await show(questionDraft('NUMBER'));
    expect(readableText(host)).toContain('Вопрос 3');
    typeInto(requireElement(host, '#question-text-' + question().id, HTMLTextAreaElement), 'Q?');
    expect(host.querySelector('[id^="question-explanation-"]')).toBeNull();
    buttonByText(host, 'Пояснение к ответу').click();
    await fixture.whenStable();
    typeInto(
      requireElement(host, '[id^="question-explanation-"]', HTMLTextAreaElement),
      'Потому что',
    );
    editor.patch({ points: 4, value: 20 });
    expect(question()).toMatchObject({ text: 'Q?', explanation: 'Потому что', points: 4 });
    expect(host.querySelector('.tb-qe__bottom .tb-stepper')).not.toBeNull();
  });

  it('marks one right option, adds one by Enter in the last and removes it', async () => {
    await show(questionDraft('SINGLE_CHOICE'));
    const [first, second] = question().options;
    editor.pick(second?.id ?? '');
    expect(question().options.map((o) => o.correct)).toEqual([false, true]);
    await fixture.whenStable();
    expect(readableText(host)).toContain('верный');
    const fields = host.querySelectorAll<HTMLInputElement>('[data-option]');
    key(fields[0] ?? host, 'Enter');
    expect(question().options).toHaveLength(2);
    key(fields[1] ?? host, 'Enter');
    await fixture.whenStable();
    expect(question().options).toHaveLength(3);
    expect(document.activeElement?.getAttribute('data-option')).toBe(question().options[2]?.id);
    buttonByText(host, 'Добавить вариант').click();
    expect(question().options).toHaveLength(4);
    await fixture.whenStable();
    buttonByText(host, 'Убрать вариант 4').click();
    expect(question().options).toHaveLength(3);
    editor.changeOption(first?.id ?? '', { text: 'Москва' });
    expect(question().options[0]?.text).toBe('Москва');
  });

  it('moves an option with the arrow keys on its handle, keeping the focus there', async () => {
    await show(questionDraft('ORDERING'));
    const [first] = question().options;
    const handle = requireElement(host, `[data-handle="${first?.id ?? ''}"]`, HTMLButtonElement);
    key(handle, 'ArrowDown');
    await fixture.whenStable();
    expect(question().options[1]?.id).toBe(first?.id);
    expect(document.activeElement?.getAttribute('data-handle')).toBe(first?.id);
    key(handle, 'Tab');
    expect(question().options[1]?.id).toBe(first?.id);
    expect(readableText(host)).toContain('Ученик увидит элементы перемешанными');
  });

  it('keeps accepted answers as chips: Enter or leaving the field, no repeats', async () => {
    await show(questionDraft('SHORT_TEXT'));
    const field = requireElement(host, '.tb-qe__new-answer', HTMLInputElement);
    typeInto(field, ' Москва ');
    key(field, 'Enter');
    typeInto(field, 'Москва');
    field.dispatchEvent(new Event('blur'));
    typeInto(field, 'москва');
    field.dispatchEvent(new Event('blur'));
    expect(question().accepted).toEqual(['Москва', 'москва']);
    await fixture.whenStable();
    requireElement(host, '[aria-label="Убрать ответ Москва"]', HTMLButtonElement).click();
    expect(question().accepted).toEqual(['москва']);
  });

  it('works the pairs of a matching: Enter in the last adds one', async () => {
    await show(questionDraft('MATCHING'));
    editor.changePair(question().pairs[0]?.id ?? '', { left: 'a', right: 'b' });
    expect(question().pairs[0]).toMatchObject({ left: 'a', right: 'b' });
    await fixture.whenStable();
    const rights = host.querySelectorAll('[aria-label^="Правая часть"]');
    key(rights[0] ?? host, 'Enter');
    key(rights[1] ?? host, 'Enter');
    await fixture.whenStable();
    expect(question().pairs).toHaveLength(3);
    buttonByText(host, 'Убрать пару 3').click();
    expect(question().pairs).toHaveLength(2);
    buttonByText(host, 'Добавить пару').click();
    expect(question().pairs).toHaveLength(3);
  });

  it('changes the type at once when nothing is lost, else after the confirmation', async () => {
    await show({ ...questionDraft('SINGLE_CHOICE'), text: 'Q' });
    buttonByText(host, 'Один ответ').click();
    await fixture.whenStable();
    menuItemByText('Несколько ответов').click();
    await fixture.whenStable();
    expect(question().type).toBe('MULTIPLE_CHOICE');
    expect(danger).not.toHaveBeenCalled();

    editor.changeOption(question().options[0]?.id ?? '', { text: 'A' });
    danger.mockResolvedValueOnce(false);
    await editor.retype('NUMBER');
    expect(question().type).toBe('MULTIPLE_CHOICE');
    danger.mockResolvedValueOnce(true);
    await editor.retype('NUMBER');
    expect(question()).toMatchObject({ type: 'NUMBER', text: 'Q' });
    await editor.retype('NUMBER');
    expect(danger).toHaveBeenCalledTimes(2);
  });

  it('says what is wrong once asked, read-only once locked, points beside the type on a phone', async () => {
    await show(questionDraft('MULTIPLE_CHOICE'));
    fixture.componentRef.setInput('showProblems', true);
    await fixture.whenStable();
    expect(readableText(host)).toContain('Напишите текст вопроса');
    fixture.componentRef.setInput('locked', true);
    fixture.componentRef.setInput('compact', true);
    fixture.componentRef.setInput('heading', false);
    await fixture.whenStable();
    expect(host.querySelector('textarea')?.disabled).toBe(true);
    expect(host.querySelector('.tb-drag-handle')).toBeNull();
    expect(host.querySelector('[aria-label="Убрать вариант 1"]')).toBeNull();
    expect(host.querySelector('.tb-qe__head .tb-stepper')).not.toBeNull();
    expect(host.querySelector('.tb-qe__title')).toBeNull();
  });
});

describe('reordering helpers', () => {
  it('move an item and read the arrow keys', () => {
    expect(reordered(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a']);
    expect(reordered(['a'], 3, 0)).toEqual(['a']);
    expect(arrowStep(new KeyboardEvent('keydown', { key: 'ArrowUp' }))).toBe(-1);
    expect(arrowStep(new KeyboardEvent('keydown', { key: 'ArrowDown' }))).toBe(1);
    expect(arrowStep(new KeyboardEvent('keydown', { key: 'Enter' }))).toBeNull();
  });
});
