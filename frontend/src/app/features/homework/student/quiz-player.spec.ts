import type { MockInstance } from 'vitest';
import { BreakpointObserver, BreakpointState } from '@angular/cdk/layout';
import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BehaviorSubject } from 'rxjs';
import { Confirm } from '@shared/ui/confirm';
import { buttonByText, readableText } from '@testing/dom';
import { testProviders } from '@testing/setup';
import { QuizAnswer, QuizQuestion } from '../data-access/homework.models';
import { QuizEdit, QuizPlayer, isAnswered } from './quiz-player';

function question(id: string, overrides: Partial<QuizQuestion> = {}): QuizQuestion {
  return {
    id,
    type: 'SINGLE_CHOICE',
    text: `Текст ${id}`,
    points: 1,
    options: [
      { id: `${id}-a`, text: 'Да' },
      { id: `${id}-b`, text: 'Нет' },
    ],
    left: [],
    right: [],
    ...overrides,
  };
}

@Component({
  imports: [QuizPlayer],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <tb-quiz-player
      [(visible)]="visible"
      [questions]="questions"
      [(answers)]="answers"
      title="Тест · Глаголы"
      subtitle="Попытка 1 из 2"
      [hint]="hint"
      (edited)="edits.push($event)"
      (finished)="finished = finished + 1"
    />
  `,
})
class Host {
  readonly visible = signal(true);
  questions: QuizQuestion[] = [
    question('q1'),
    question('q2'),
    question('q3', {
      type: 'MATCHING',
      left: [{ id: 'p1', text: 'Кот' }],
      right: [{ id: 'p1', text: 'Мяу' }],
    }),
  ];
  readonly answers = signal<Readonly<Record<string, QuizAnswer>>>({ q1: { ids: ['q1-a'] } });
  hint: string | null = 'Правильные ответы покажем после сдачи.';
  readonly edits: QuizEdit[] = [];
  finished = 0;
}

describe('QuizPlayer', () => {
  let fixture: ComponentFixture<Host>;
  let safe: MockInstance<Confirm['safe']>;
  const body = (): HTMLElement => document.body;

  async function render(compact = false, setup?: (host: Host) => void): Promise<void> {
    const phone = new BehaviorSubject<BreakpointState>({ matches: compact, breakpoints: {} });
    TestBed.configureTestingModule({
      imports: [Host],
      providers: testProviders({ provide: BreakpointObserver, useValue: { observe: () => phone } }),
    });
    safe = vi.spyOn(TestBed.inject(Confirm), 'safe').mockResolvedValue(true);
    fixture = TestBed.createComponent(Host);
    setup?.(fixture.componentInstance);
    await fixture.whenStable();
  }

  afterEach(() => {
    fixture.destroy();
  });

  it('opens at the first question without an answer and marks the answered numbers', async () => {
    await render();
    const text = readableText(body());
    expect(text).toContain('Тест · Глаголы');
    expect(text).toContain('Вопрос 2 из 3');
    expect(text).toContain('Один ответ · 1 б.');
    expect(text).toContain('Правильные ответы покажем после сдачи.');
    const numbers = body().querySelectorAll('.tb-qp__number');
    expect(numbers[0]?.getAttribute('aria-label')).toBe('Вопрос 1, есть ответ');
    expect(numbers[1]?.getAttribute('aria-current')).toBe('step');
    expect(body().querySelector('[aria-label="Отвечено 1 из 3"]')).not.toBeNull();
  });

  it('goes to a question by its number and back', async () => {
    await render();
    body().querySelectorAll<HTMLButtonElement>('.tb-qp__number')[2]?.click();
    await fixture.whenStable();
    expect(readableText(body())).toContain('Вопрос 3 из 3');
    expect(readableText(body())).toContain('Кот');
    buttonByText(body(), 'Назад').click();
    await fixture.whenStable();
    expect(readableText(body())).toContain('Вопрос 2 из 3');
  });

  it('answers by a click and finishes without asking when every question has an answer', async () => {
    await render(false, (host) => {
      host.answers.set({ q1: { ids: ['q1-a'] }, q3: { pairs: { p1: 'p1' } } });
    });
    body().querySelector<HTMLInputElement>('#o-q2-b')?.click();
    await fixture.whenStable();
    const host = fixture.componentInstance;
    expect(host.answers()['q2']).toEqual({ ids: ['q2-b'] });
    expect(host.edits.at(-1)).toEqual({ question: host.questions[1], now: true });

    buttonByText(body(), 'Дальше').click();
    await fixture.whenStable();
    buttonByText(body(), 'Завершить тест').click();
    await fixture.whenStable();
    expect(safe).not.toHaveBeenCalled();
    expect(host.finished).toBe(1);
  });

  it('on a phone has dots, an icon «Назад» and no column of numbers', async () => {
    await render(true);
    expect(body().querySelectorAll('.tb-qp__dot')).toHaveLength(3);
    expect(body().querySelector('button[aria-label="Назад"] .p-button-label')).toBeNull();
  });

  it('knows an answer from an empty one', () => {
    expect(isAnswered(undefined)).toBe(false);
    expect(isAnswered({ ids: [] })).toBe(false);
    expect(isAnswered({ text: '  ' })).toBe(false);
    expect(isAnswered({ number: 0 })).toBe(true);
    expect(isAnswered({ pairs: { a: 'b' } })).toBe(true);
    expect(isAnswered({ text: 'да' })).toBe(true);
  });
});
