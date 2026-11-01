import { TestBed } from '@angular/core/testing';
import { hostElement, readableText } from '@testing/dom';
import { testProviders } from '@testing/setup';
import { QuizSettings } from './quiz-settings';

describe('QuizSettings', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [QuizSettings], providers: testProviders() });
  });

  it('shows the reveal radios and the attempts as a button group', async () => {
    const fixture = TestBed.createComponent(QuizSettings);
    const host = hostElement(fixture);
    await fixture.whenStable();
    expect(host.querySelectorAll('input[type="radio"]')).toHaveLength(3);
    expect(readableText(host)).toContain('Сразу после сдачи теста');
    [...host.querySelectorAll<HTMLElement>('p-togglebutton')]
      .find((item) => item.textContent.includes('Без огр.'))
      ?.click();
    expect(fixture.componentInstance.attempts()).toBe(0);
  });

  it('offers the attempts it was given even when they are not in the group', async () => {
    const fixture = TestBed.createComponent(QuizSettings);
    const host = hostElement(fixture);
    fixture.componentInstance.attempts.set(5);
    await fixture.whenStable();
    expect(readableText(host)).toMatch(/3\s*5\s*Без огр\./);
  });
});
