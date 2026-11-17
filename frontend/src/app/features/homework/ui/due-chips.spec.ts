import { TestBed } from '@angular/core/testing';
import { hostElement, requireElement, typeInto } from '@testing/dom';
import { testProviders } from '@testing/setup';
import { DueChips, dueAtOf, effectiveDue } from './due-chips';

describe('due chips', () => {
  const lesson = new Date('2026-11-05T15:00:00Z');
  const picked = new Date('2026-11-09T10:00:00Z');

  it('drops the lesson choice when there is no lesson ahead', () => {
    expect(effectiveDue('lesson', null)).toBe('none');
    expect(effectiveDue('lesson', lesson)).toBe('lesson');
    expect(effectiveDue('date', null)).toBe('date');
  });

  it('turns a choice into the due date', () => {
    expect(dueAtOf('lesson', lesson, picked)).toBe(lesson);
    expect(dueAtOf('lesson', null, picked)).toBeNull();
    expect(dueAtOf('date', lesson, picked)).toBe(picked);
    expect(dueAtOf('none', lesson, picked)).toBeNull();
    const week = dueAtOf('week', null, null)?.getTime() ?? 0;
    expect(week - Date.now()).toBeGreaterThan(6.9 * 24 * 60 * 60 * 1000);
  });
});

describe('DueChips', () => {
  it('takes a date and a time typed into two fields', async () => {
    TestBed.configureTestingModule({ imports: [DueChips], providers: testProviders() });
    const fixture = TestBed.createComponent(DueChips);
    fixture.componentRef.setInput('choice', 'date');
    await fixture.whenStable();
    const host = hostElement(fixture);
    const type = (selector: string, text: string): void => {
      const input = requireElement(host, selector, HTMLInputElement);
      typeInto(input, text);
      input.dispatchEvent(new FocusEvent('blur'));
    };

    type('#homework-due-at', '9.11.2026');
    type('#homework-due-at-time', '18:30');
    await fixture.whenStable();

    expect(requireElement(host, 'label[for="homework-due-at"]', HTMLLabelElement).textContent).toBe(
      'Срок сдачи',
    );
    expect(fixture.componentInstance.date()).toEqual(new Date(2026, 10, 9, 18, 30));
  });
});
