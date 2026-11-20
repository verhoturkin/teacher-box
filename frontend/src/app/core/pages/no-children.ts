import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ButtonDirective, ButtonIcon, ButtonLabel } from 'primeng/button';
import { Card } from 'primeng/card';
import { AuthService } from '@core/auth/auth.service';
import { CORE_T } from '@core/i18n/texts';
import { EmptyState } from '@shared/ui/empty-state';

/**
 * `/family` of a parent without a current child (ADR-0069: the teacher unlinked or deactivated the
 * last one while the parent was signed in). There is no frame without a child, so the page brings its
 * own `main` and the way out.
 */
@Component({
  selector: 'tb-no-children-page',
  imports: [ButtonDirective, ButtonIcon, ButtonLabel, Card, EmptyState],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="tb-no-children">
      <p-card>
        <tb-empty-state icon="tb-i-family_restroom" [title]="t.noneTitle" [hint]="t.noneHint">
          <button pButton type="button" severity="secondary" (click)="signOut()">
            <i pButtonIcon aria-hidden="true" class="tb-i tb-i-logout"></i>
            <span pButtonLabel>{{ t.signOut }}</span>
          </button>
        </tb-empty-state>
      </p-card>
    </main>
  `,
  styles: `
    .tb-no-children {
      box-sizing: border-box;
      max-width: var(--tb-content-narrow);
      margin: 0 auto;
      padding: var(--tb-space-8) var(--tb-space-4);
    }
  `,
})
export class NoChildrenPage {
  protected readonly t = CORE_T.family;
  private readonly auth = inject(AuthService);

  protected signOut(): void {
    this.auth.logout().subscribe();
  }
}
