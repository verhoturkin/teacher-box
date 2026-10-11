import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonDirective, ButtonIcon, ButtonLabel } from 'primeng/button';
import { T } from './i18n/texts';

/** What the teacher does most often, one tap from the home page: each link opens the form on its page. */
const ACTIONS = [
  {
    label: T.quickActions.lesson,
    icon: 'pi-calendar-plus',
    link: '/teacher/schedule',
    create: 'lesson',
  },
  { label: T.quickActions.payment, icon: 'pi-wallet', link: '/teacher/billing', create: 'payment' },
  {
    label: T.quickActions.student,
    icon: 'pi-user-plus',
    link: '/teacher/students',
    create: 'student',
  },
  {
    label: T.quickActions.assignment,
    icon: 'pi-book',
    link: '/teacher/homework',
    create: 'assignment',
  },
] as const;

@Component({
  selector: 'tb-quick-actions',
  imports: [RouterLink, ButtonDirective, ButtonIcon, ButtonLabel],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="tb-quick-actions" role="group" [attr.aria-label]="t.title">
      @for (action of actions; track action.create) {
        <a
          pButton
          severity="secondary"
          [routerLink]="action.link"
          [queryParams]="{ create: action.create }"
        >
          <i pButtonIcon aria-hidden="true" class="pi {{ action.icon }}"></i>
          <span pButtonLabel>{{ action.label }}</span>
        </a>
      }
    </div>
  `,
  styles: `
    .tb-quick-actions {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: var(--tb-space-2);

      @media (width <= 30em) {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }
  `,
})
export class QuickActions {
  protected readonly t = T.quickActions;
  protected readonly actions = ACTIONS;
}
