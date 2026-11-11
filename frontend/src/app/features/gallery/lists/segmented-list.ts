import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { Tag } from 'primeng/tag';
import { Avatar } from '@shared/ui/avatar';

const STUDENTS = ['Anna Petrova', 'Ivan Orlov', 'Maria Sokolova'] as const;

/**
 * §10 The segmented list `ul.tb-list`: tiles on a subgrid of lead, text and trail; `tb-list__link` makes the
 * row open as a whole (hover state layer), `tb-list__item--current` marks the row of the open detail.
 */
@Component({
  selector: 'tb-gallery-segmented-list',
  imports: [RouterLink, ButtonModule, Tag, Avatar],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ul class="tb-list" aria-label="Students">
      @for (name of students; track name; let index = $index) {
        <li [class.tb-list__item--current]="current() === name">
          <tb-avatar
            class="tb-list__lead"
            [name]="name"
            [attr.data-tb-label]="index === 0 ? 'blue' : null"
          />
          <div class="tb-list__text">
            <a
              class="tb-list__title tb-list__link"
              [routerLink]="[]"
              [queryParams]="{ row: index }"
              (click)="current.set(name)"
              >{{ name }}</a
            >
            <span class="tb-list__supporting">Tuesdays at 14:00 · English</span>
          </div>
          <div class="tb-list__trail">
            @if (index === 1) {
              <p-tag severity="danger" value="Debt" />
            }
            <p-button
              icon="tb-i tb-i-edit"
              [text]="true"
              [rounded]="true"
              severity="secondary"
              [ariaLabel]="'Edit: ' + name"
            />
          </div>
        </li>
      }
      <li>
        <span class="tb-list__lead" aria-hidden="true"><i class="tb-i tb-i-receipt_long"></i></span>
        <div class="tb-list__text">
          <span class="tb-list__title">Payment for October</span>
          <span class="tb-list__supporting">A static row: no hover</span>
        </div>
        <span class="tb-list__trail tb-list__trail--amount">4 500 ₽</span>
      </li>
    </ul>
    <code class="tb-gallery-name"
      >ul.tb-list > li > .tb-list__lead + .tb-list__text(.tb-list__title, .tb-list__supporting) +
      .tb-list__trail</code
    >
  `,
})
export class SegmentedListSample {
  protected readonly students = STUDENTS;
  protected readonly current = signal<string>(STUDENTS[0]);
}
