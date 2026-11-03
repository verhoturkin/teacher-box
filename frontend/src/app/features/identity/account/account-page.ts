import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { AuthService } from '@core/auth/auth.service';
import { injectWindowSize } from '@core/layout/mobile';
import { HelpButton } from '@features/help/parts';
import { PageHeader } from '@shared/ui/page-header';
import { Pane, Panes } from '@shared/ui/panes';
import { AccountPanel } from './account-panel';
import { T } from '../i18n/texts';

/**
 * «Мой аккаунт» of a student and the administrator in one pane at full width (sketch StudentAccount);
 * the teacher's is a category of the settings.
 */
@Component({
  selector: 'tb-account-page',
  imports: [AccountPanel, HelpButton, PageHeader, Pane, Panes],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <tb-panes>
      <tb-pane [label]="t.title">
        <tb-page-header tbPaneHeader [title]="t.title">
          @if (expanded()) {
            <span help class="tb-account-page__saved">
              <i class="tb-i tb-i-cloud_done" aria-hidden="true"></i>{{ t.savedAtOnce }}
            </span>
          }
          @if (student()) {
            <tb-help-button help topic="cabinet/login" />
          }
        </tb-page-header>
        <tb-account-panel />
      </tb-pane>
    </tb-panes>
  `,
  styles: `
    .tb-account-page__saved {
      display: inline-flex;
      flex: 1;
      align-items: center;
      gap: var(--tb-space-1);
      margin-inline-start: var(--tb-space-3);
      color: var(--p-md-on-surface-variant);
      font: var(--tb-type-body-m);

      .tb-i {
        font-size: 1.125rem;
      }
    }
  `,
})
export class AccountPage {
  protected readonly t = T.account;
  private readonly user = inject(AuthService).user;
  protected readonly student = computed(() => this.user()?.role === 'STUDENT');
  private readonly size = injectWindowSize();
  protected readonly expanded = computed(() => !['compact', 'medium'].includes(this.size()));
}
