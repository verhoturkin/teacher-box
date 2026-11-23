import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';

const COURSES = [
  { id: 'a2', name: 'English A2', count: 14 },
  { id: 'b1', name: 'English B1', count: 27 },
  { id: 'oge', name: 'OGE', count: 8 },
] as const;

/**
 * §7 The navigation menu of a list pane `nav.tb-nav-menu` («Материалы»): one surface, 48 px pill items with
 * the icon, the label and the count, a headline and a divider between the groups; the chosen item has the
 * pill indicator of the rail; «⋮» shows on the chosen item, on hover and on focus.
 */
@Component({
  selector: 'tb-gallery-nav-menu',
  imports: [RouterLink, ButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav class="tb-nav-menu tb-gallery-nav-menu" aria-label="Places">
      <span class="tb-nav-menu__headline" id="tb-gallery-nav-menu-courses" aria-hidden="true"
        >Courses</span
      >
      <ul class="tb-nav-menu__list" aria-labelledby="tb-gallery-nav-menu-courses">
        @for (course of courses; track course.id) {
          <li
            class="tb-nav-menu__item"
            [class.tb-nav-menu__item--current]="current() === course.id"
          >
            <button type="button" class="tb-drag-handle" [attr.aria-label]="'Move ' + course.name">
              <i class="tb-i tb-i-drag_indicator" aria-hidden="true"></i>
            </button>
            <i class="tb-i tb-i-collections_bookmark" aria-hidden="true"></i>
            <a
              class="tb-nav-menu__link"
              [routerLink]="[]"
              [attr.aria-current]="current() === course.id ? 'page' : null"
              (click)="current.set(course.id)"
              >{{ course.name }}</a
            >
            <span class="tb-nav-menu__count">{{ course.count }}</span>
            <p-button
              class="tb-nav-menu__more"
              icon="tb-i tb-i-more_vert"
              severity="secondary"
              [text]="true"
              [rounded]="true"
              [ariaLabel]="'Actions: ' + course.name"
            />
          </li>
        }
        <li class="tb-nav-menu__item tb-nav-menu__item--action">
          <i class="tb-i tb-i-add" aria-hidden="true"></i>
          <button type="button" class="tb-nav-menu__link">New course</button>
        </li>
      </ul>
      <hr class="tb-nav-menu__divider" />
      <ul class="tb-nav-menu__list">
        <li class="tb-nav-menu__item">
          <i class="tb-i tb-i-co_present" aria-hidden="true"></i>
          <a class="tb-nav-menu__link" [routerLink]="[]">Boards</a>
          <span class="tb-nav-menu__count">11</span>
        </li>
      </ul>
    </nav>
    <code class="tb-gallery-name"
      >nav.tb-nav-menu > ul.tb-nav-menu__list > li.tb-nav-menu__item(--current, --action) > .tb-i +
      .tb-nav-menu__link + .tb-nav-menu__count + .tb-nav-menu__more · .tb-nav-menu__headline ·
      hr.tb-nav-menu__divider · .tb-nav-menu--touch</code
    >
  `,
  styles: '.tb-gallery-nav-menu { max-inline-size: 18.75rem; }',
})
export class NavMenuSample {
  protected readonly courses = COURSES;
  protected readonly current = signal<string>('b1');
}
