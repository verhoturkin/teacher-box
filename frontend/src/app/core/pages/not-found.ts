import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonDirective, ButtonIcon, ButtonLabel } from 'primeng/button';
import { Card } from 'primeng/card';
import { EmptyState } from '@shared/ui/empty-state';
import { PageHeader } from '@shared/ui/page-header';

/**
 * «Страница не найдена» inside the frame of the role (ADR-0026): the header, the navigation and the
 * name of the portal stay, so a stale link from a notification or a bookmark does not throw the
 * user out of the portal.
 */
@Component({
  selector: 'tb-not-found',
  imports: [RouterLink, ButtonDirective, ButtonIcon, ButtonLabel, Card, EmptyState, PageHeader],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <tb-page-header title="Страница не найдена" />
    <p-card>
      <tb-empty-state
        icon="pi-compass"
        title="Такой страницы нет"
        hint="Ссылка могла устареть или в адресе опечатка. Вернитесь на главную и найдите нужный раздел в меню."
      >
        <a pButton routerLink="/">
          <i pButtonIcon aria-hidden="true" class="pi pi-home"></i>
          <span pButtonLabel>На главную</span>
        </a>
      </tb-empty-state>
    </p-card>
  `,
})
export class NotFound {}

/** The same page for a visitor who is not signed in: there is no frame, so it brings its own `main`. */
@Component({
  selector: 'tb-not-found-page',
  imports: [NotFound],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<main class="tb-not-found-page"><tb-not-found /></main>`,
  styles: `
    .tb-not-found-page {
      box-sizing: border-box;
      max-width: var(--tb-content-narrow);
      margin: 0 auto;
      padding: var(--tb-space-8) var(--tb-space-4);
    }
  `,
})
export class NotFoundPage {}
