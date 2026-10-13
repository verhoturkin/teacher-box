import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonDirective, ButtonIcon, ButtonLabel } from 'primeng/button';
import { injectMobile } from '@core/layout/mobile';
import { FabMenu, FabMenuItem } from '@shared/ui/fab-menu';
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

const FAB_ITEMS: readonly FabMenuItem[] = ACTIONS.map((action) => ({
  label: action.label,
  icon: action.icon,
  link: action.link,
  queryParams: { create: action.create },
}));

/** On a computer — a row of buttons under the title; on a phone — the FAB menu (M3 Expressive). */
@Component({
  selector: 'tb-quick-actions',
  imports: [RouterLink, ButtonDirective, ButtonIcon, ButtonLabel, FabMenu],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (mobile()) {
      <tb-fab-menu [items]="fabItems" [label]="t.title" />
    } @else {
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
    }
  `,
  styles: `
    .tb-quick-actions {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: var(--tb-space-2);
    }
  `,
})
export class QuickActions {
  protected readonly t = T.quickActions;
  protected readonly actions = ACTIONS;
  protected readonly fabItems = FAB_ITEMS;
  protected readonly mobile = injectMobile();
}
