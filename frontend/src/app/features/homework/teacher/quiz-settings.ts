import { ChangeDetectionStrategy, Component, computed, model } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RadioButton } from 'primeng/radiobutton';
import { SelectButton } from 'primeng/selectbutton';
import { QuizReveal } from '../data-access/homework.models';
import { T } from '../i18n/texts';

const REVEALS: readonly QuizReveal[] = ['AFTER_SUBMIT', 'AFTER_DUE', 'NEVER'];
const ATTEMPTS = [1, 2, 3, 0];

function sortAttempts(a: number, b: number): number {
  return (a === 0 ? Infinity : a) - (b === 0 ? Infinity : b);
}

/**
 * «Как проходит тест» (sketch 28): when the right answers show — radios — and how many attempts a student has —
 * a connected button group «1 · 2 · 3 · Без огр.» (a saved other number joins it).
 */
@Component({
  selector: 'tb-quiz-settings',
  imports: [FormsModule, RadioButton, SelectButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="tb-field" role="radiogroup" aria-labelledby="quiz-reveal">
      <span id="quiz-reveal">{{ t.reveal }}</span>
      @for (option of revealOptions; track option.value) {
        <div class="tb-quiz-settings__radio">
          <p-radiobutton
            name="quiz-reveal"
            [inputId]="'quiz-reveal-' + option.value"
            [value]="option.value"
            [ngModel]="reveal()"
            (ngModelChange)="reveal.set($event)"
          />
          <label [for]="'quiz-reveal-' + option.value">{{ option.label }}</label>
        </div>
      }
    </div>
    <div class="tb-field">
      <span id="quiz-attempts">{{ t.attempts }}</span>
      <p-selectbutton
        [options]="attemptOptions()"
        optionLabel="label"
        optionValue="value"
        [allowEmpty]="false"
        ariaLabelledBy="quiz-attempts"
        [ngModel]="attempts()"
        (ngModelChange)="attempts.set($event)"
      />
      <small class="tb-hint">{{ t.attemptsHint }}</small>
    </div>
  `,
  styles: `
    :host {
      display: grid;
      gap: var(--tb-space-4);
    }

    .tb-quiz-settings__radio {
      display: flex;
      gap: var(--tb-space-3);
      align-items: center;
      min-height: 2.5rem;
    }

    .tb-quiz-settings__radio label {
      cursor: pointer;
    }
  `,
})
export class QuizSettings {
  protected readonly t = T.quiz;
  protected readonly revealOptions = REVEALS.map((value) => ({
    value,
    label: T.quiz.reveals[value],
  }));

  readonly reveal = model<QuizReveal>('AFTER_SUBMIT');
  /** 0 — unlimited. */
  readonly attempts = model(1);

  protected readonly attemptOptions = computed(() =>
    (ATTEMPTS.includes(this.attempts())
      ? ATTEMPTS
      : [...ATTEMPTS, this.attempts()].sort(sortAttempts)
    ).map((value) => ({ value, label: T.quiz.attemptShort(value) })),
  );
}
