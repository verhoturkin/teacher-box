import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonDirective, ButtonIcon } from 'primeng/button';
import { Tooltip } from 'primeng/tooltip';

/**
 * The header of a page (ADR-0018): «back» as an icon on nested pages, the title with the «?» of
 * the help, a line of details under it and the actions on the right, the main one last.
 *
 * ```html
 * <tb-page-header title="Отчёт за месяц" back="/teacher/billing" backLabel="Оплаты">
 *   <tb-help-button help topic="teacher/billing" />
 *   <span meta>Срок: 02.10</span>
 *   <p-button label="Оплата" class="tb-page-fab" />
 * </tb-page-header>
 * ```
 */
@Component({
  selector: 'tb-page-header',
  imports: [RouterLink, ButtonDirective, ButtonIcon, Tooltip],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'tb-page-header' },
  template: `
    <div class="tb-page-header__lead">
      @if (back(); as link) {
        <a
          pButton
          [routerLink]="link"
          [text]="true"
          [rounded]="true"
          severity="secondary"
          class="tb-page-header__back"
          [attr.aria-label]="backLabel()"
          [pTooltip]="backLabel()"
        >
          <i pButtonIcon aria-hidden="true" class="pi pi-arrow-left"></i>
        </a>
      }
      <div class="tb-page-header__text">
        <div class="tb-page-heading">
          <h1 class="tb-page-title">{{ title() }}</h1>
          <ng-content select="[help]" />
        </div>
        <ng-content select="[meta]" />
      </div>
    </div>
    <div class="tb-actions">
      <ng-content />
    </div>
  `,
})
export class PageHeader {
  readonly title = input.required<string>();
  /** The link of «back» on a nested page; none on a section page. */
  readonly back = input<string | readonly unknown[] | null>(null);
  /** Where «back» leads, e.g. «Все задания»: its name and tooltip. */
  readonly backLabel = input('Назад');
}
