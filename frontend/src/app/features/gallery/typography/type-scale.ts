import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TokenValue } from '../token-value';

/** A role and its tracking (display, headline and title large have none). */
const ROLES = [
  { role: 'display-s', tracking: null },
  { role: 'headline-l', tracking: null },
  { role: 'headline-s', tracking: null },
  { role: 'title-l', tracking: null },
  { role: 'title-m', tracking: 'title-m' },
  { role: 'title-s', tracking: 'title-s' },
  { role: 'body-l', tracking: 'body-l' },
  { role: 'body-m', tracking: 'body-m' },
  { role: 'body-s', tracking: 'body-s' },
  { role: 'label-l', tracking: 'label-l' },
  { role: 'label-m', tracking: 'label-m' },
  { role: 'label-s', tracking: 'label-s' },
] as const;

/** §3 Type scale: `font: var(--tb-type-<role>)` with `letter-spacing: var(--tb-tracking-<role>)`. */
@Component({
  selector: 'tb-gallery-type-scale',
  imports: [TokenValue],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ul class="tb-gallery-cell type">
      @for (item of roles; track item.role) {
        <li>
          <p
            class="line"
            [style.font]="'var(--tb-type-' + item.role + ')'"
            [style.letter-spacing]="
              item.tracking ? 'var(--tb-tracking-' + item.tracking + ')' : null
            "
          >
            Lesson at 14:00
          </p>
          <code class="tb-gallery-name">font: var(--tb-type-{{ item.role }})</code>
          <span class="tb-gallery-name"> — {{ '--tb-type-' + item.role | tbTokenValue }}</span>
          @if (item.tracking) {
            <code class="tb-gallery-name"
              >; letter-spacing: var(--tb-tracking-{{ item.tracking }})</code
            >
          }
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
