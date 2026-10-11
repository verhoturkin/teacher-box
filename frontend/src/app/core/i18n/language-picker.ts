import { ChangeDetectionStrategy, Component } from '@angular/core';
import { LANGUAGES, Language, chooseLanguage, language } from './language';

/**
 * The languages as a row of links under the card of the sign-in and invitation pages (ADR-0035): the
 * user who does not read the current one finds theirs before signing in. Each name is in its own language.
 */
@Component({
  selector: 'tb-language-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'tb-language-picker', role: 'group', 'aria-label': 'Language / Язык' },
  template: `
    <i class="pi pi-language" aria-hidden="true"></i>
    @for (item of languages; track item.code) {
      <button
        type="button"
        class="tb-language-picker__item"
        [attr.lang]="item.code"
        [attr.aria-pressed]="item.code === current"
        (click)="choose(item.code)"
      >
        {{ item.name }}
      </button>
    }
  `,
  styles: `
    :host {
      display: flex;
      flex-wrap: wrap;
      gap: var(--tb-space-1);
      align-items: center;
      justify-content: center;
      color: var(--p-md-on-surface-variant);
    }

    .tb-language-picker__item {
      min-height: 2.5rem;
      padding: 0 var(--tb-space-3);
      border: none;
      border-radius: 1.25rem;
      background: transparent;
      color: var(--p-primary-color);
      font: var(--tb-type-label-l);
      cursor: pointer;
    }

    .tb-language-picker__item:hover {
      background: color-mix(in srgb, var(--p-primary-color) 8%, transparent);
    }

    .tb-language-picker__item:focus-visible {
      outline: 2px solid var(--p-primary-color);
      outline-offset: 2px;
    }

    .tb-language-picker__item[aria-pressed='true'] {
      background: var(--p-md-secondary-container);
      color: var(--p-md-on-secondary-container);
    }
  `,
})
export class LanguagePicker {
  protected readonly languages = LANGUAGES;
  protected readonly current = language();

  protected choose(code: Language): void {
    chooseLanguage(code);
  }
}
