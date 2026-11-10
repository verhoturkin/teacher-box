import { ChangeDetectionStrategy, Component } from '@angular/core';

/** Where the product uses an emphasized role (§3). */
const ROLES = [
  { role: 'headline-m-emphasized', use: 'page title' },
  { role: 'headline-s-emphasized', use: 'dialog title; page title on a phone' },
  { role: 'title-l-emphasized', use: 'card and pane section title' },
  { role: 'title-m-emphasized', use: 'section title on a pane' },
  { role: 'label-l-emphasized', use: 'selected item, count of a filter chip' },
  { role: 'display-s-emphasized', use: 'the hero time' },
] as const;

/** §3 Emphasized roles (M3E): the same size and line, heavier; they mark the exception. */
@Component({
  selector: 'tb-gallery-emphasized',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ul class="tb-gallery-cell type">
      @for (item of roles; track item.role) {
        <li>
          <p class="line" [style.font]="'var(--tb-type-' + item.role + ')'">Lesson at 14:00</p>
          <code class="tb-gallery-name">font: var(--tb-type-{{ item.role }})</code>
          <span class="tb-gallery-name"> — {{ item.use }}</span>
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
export class EmphasizedSample {
  protected readonly roles = ROLES;
}
