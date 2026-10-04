import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Button } from 'primeng/button';
import { Drawer } from 'primeng/drawer';
import { Tooltip } from 'primeng/tooltip';
import { ModalDrawer } from '@shared/ui/modal-drawer';
import { HelpArticleView } from './help-article-view';
import { HelpLibrary } from './help-library';
import { HelpArticle } from './help.models';
import { HELP_TITLES, HelpTopic, helpUrl } from './help-topics';

/**
 * «?» (or «Подробнее») next to a heading: opens the help article in a side panel without leaving
 * the page. The panel is modal (ADR-0024): the focus is in it until it closes, then back on «?».
 */
@Component({
  selector: 'tb-help-button',
  imports: [RouterLink, Button, Drawer, HelpArticleView, Tooltip, ModalDrawer],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (label(); as text) {
      <p-button [label]="text" icon="pi pi-question-circle" [text]="true" (onClick)="open()" />
    } @else {
      <p-button
        icon="pi pi-question-circle"
        [text]="true"
        [pTooltip]="name()"
        [rounded]="true"
        severity="secondary"
        [ariaLabel]="name()"
        (onClick)="open()"
      />
    }
    <p-drawer
      tbModalDrawer
      [(visible)]="visible"
      position="right"
      appendTo="body"
      [blockScroll]="true"
      ariaCloseLabel="Закрыть"
      [header]="article()?.title ?? 'Справка'"
      styleClass="tb-help-drawer"
    >
      @if (article(); as current) {
        <tb-help-article [body]="current.body" (navigated)="visible.set(false)" />
        <p>
          <a [routerLink]="url()" (click)="visible.set(false)">Вся справка</a>
        </p>
      }
    </p-drawer>
  `,
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
    }

    :host ::ng-deep .tb-help-drawer {
      width: min(36rem, 100vw);
    }
  `,
})
export class HelpButton {
  private readonly library = inject(HelpLibrary);

  readonly topic = input.required<HelpTopic>();
  /** A text link instead of the «?» icon, e.g. «Подробнее». */
  readonly label = input<string>();

  readonly visible = signal(false);
  protected readonly article = signal<HelpArticle | null>(null);
  protected readonly url = computed(() => helpUrl(this.topic()));
  /** «Справка: Расписание и запросы»: the buttons of a page are told apart (ADR-0026). */
  protected readonly name = computed(() => `Справка: ${HELP_TITLES[this.topic()]}`);

  async open(): Promise<void> {
    this.article.set(await this.library.article(this.topic()));
    this.visible.set(true);
  }
}
