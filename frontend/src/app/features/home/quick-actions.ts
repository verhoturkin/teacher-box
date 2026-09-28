import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonDirective, ButtonIcon, ButtonLabel } from 'primeng/button';

/** What the teacher does most often, one tap from the home page: each link opens the form on its page. */
const ACTIONS = [
  { label: 'Занятие', icon: 'pi-calendar-plus', link: '/teacher/schedule', create: 'lesson' },
  { label: 'Оплата', icon: 'pi-wallet', link: '/teacher/billing', create: 'payment' },
  { label: 'Ученик', icon: 'pi-user-plus', link: '/teacher/students', create: 'student' },
  { label: 'Задание', icon: 'pi-book', link: '/teacher/homework', create: 'assignment' },
] as const;

@Component({
  selector: 'tb-quick-actions',
  imports: [RouterLink, ButtonDirective, ButtonIcon, ButtonLabel],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav class="tb-quick-actions" aria-label="Быстрые действия">
      @for (action of actions; track action.create) {
        <a
          pButton
          [outlined]="true"
          [routerLink]="action.link"
          [queryParams]="{ create: action.create }"
        >
          <i pButtonIcon aria-hidden="true" class="pi {{ action.icon }}"></i>
          <span pButtonLabel>{{ action.label }}</span>
        </a>
      }
    </nav>
  `,
  styles: `
    .tb-quick-actions {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: var(--tb-space-2);

      @media (max-width: 480px) {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }
  `,
})
export class QuickActions {
  protected readonly actions = ACTIONS;
}
