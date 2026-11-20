import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TokenValue } from '../token-value';

/** The baseline roles; each has its tracking token, zero for display, headline and title large. */
const ROLES = [
  'display-s',
  'headline-l',
  'headline-s',
  'title-l',
  'title-m',
  'title-s',
  'body-l',
  'body-m',
  'body-s',
  'label-l',
  'label-m',
  'label-s',
] as const;

/** §3 Type scale: `font: var(--tb-type-<role>)` with `letter-spacing: var(--tb-tracking-<role>)`. */
@Component({
  selector: 'tb-gallery-type-scale',
  imports: [TokenValue],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ul class="tb-gallery-cell type">
      @for (role of roles; track role) {
        <li>
          <p
            class="line"
            [style.font]="'var(--tb-type-' + role + ')'"
            [style.letter-spacing]="'var(--tb-tracking-' + role + ')'"
          >
            Lesson at 14:00
          </p>
          <code class="tb-gallery-name">font: var(--tb-type-{{ role }})</code>
          <span class="tb-gallery-name"> — {{ '--tb-type-' + role | tbTokenValue }}</span>
          <code class="tb-gallery-name">; letter-spacing: var(--tb-tracking-{{ role }})</code>
        </li>
      }
    </ul>
  `,
  styles: `
    .type {
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .line {
      margin: 0;
    }
  `,
})
export class TypeScaleSample {
  protected readonly roles = ROLES;
}
