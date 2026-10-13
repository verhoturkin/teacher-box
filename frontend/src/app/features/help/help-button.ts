import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { Button } from 'primeng/button';
import { Drawer } from 'primeng/drawer';
import { Tooltip } from 'primeng/tooltip';
import { ModalDrawer } from '@shared/ui/modal-drawer';
import { HelpArticleView } from './help-article-view';
import { HelpLibrary } from './help-library';
import { HelpArticle } from './help.models';
import { HELP_TITLES, HelpTopic, helpUrl } from './help-topics';
import { T } from './i18n/texts';
import { SHARED_T } from '@shared/i18n/texts';

/**
 * «?» (or «Подробнее») next to a heading: opens the help article in an M3 modal side sheet without
 * leaving the page. The sheet is modal (ADR-0024): the focus is in it until it closes, then back on
 * «?». A link to another article opens it in the sheet; «←» in the header returns to the previous one.
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
      [ariaCloseLabel]="c.close"
      styleClass="tb-side-sheet"
    >
      <ng-template #header>
        <div class="tb-side-sheet__head">
          @if (trail().length > 1) {
            <p-button
              icon="pi pi-arrow-left"
              [text]="true"
              [rounded]="true"
              severity="secondary"
              [ariaLabel]="c.back"
              (onClick)="back()"
            />
          }
          <span class="p-drawer-title">{{ article()?.title ?? t.help }}</span>
        </div>
      </ng-template>
      @if (article(); as current) {
        <tb-help-article
          [body]="current.body"
          [inSheet]="true"
          (article)="openLinked($event)"
          (navigated)="visible.set(false)"
        />
        <p>
          <a [routerLink]="url()" (click)="visible.set(false)">{{ t.all }}</a>
        </p>
      }
    </p-drawer>
  `,
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
    }
  `,
})
export class HelpButton {
  protected readonly c = SHARED_T.common;
  protected readonly t = T;
  private readonly library = inject(HelpLibrary);

  readonly topic = input.required<HelpTopic>();
  /** A text link instead of the «?» icon, e.g. «Подробнее». */
  readonly label = input<string>();

  readonly visible = signal(false);
  /** The articles opened in the sheet, the current one last. */
  protected readonly trail = signal<readonly HelpArticle[]>([]);
  protected readonly article = computed(() => this.trail().at(-1) ?? null);
  private readonly drawer = viewChild(Drawer);

  constructor() {
    // another article starts from its top
    effect(() => {
      this.article();
      const content = this.drawer()?.container?.querySelector('.p-drawer-content');
      if (content instanceof HTMLElement) {
        content.scrollTop = 0;
      }
    });
  }
  protected readonly url = computed(() => helpUrl(this.topic()));
  /** «Справка: Расписание и запросы»: the buttons of a page are told apart (ADR-0026). */
  protected readonly name = computed(() => T.helpOf(HELP_TITLES[this.topic()]));

  async open(): Promise<void> {
    const article = await this.library.article(this.topic());
    this.trail.set(article === null ? [] : [article]);
    this.visible.set(true);
  }

  /** A link of the article to another one: it opens in the sheet. */
  async openLinked(topic: string): Promise<void> {
    const article = await this.library.article(topic);
    if (article !== null) {
      this.trail.update((trail) => [...trail, article]);
    }
  }

  back(): void {
    this.trail.update((trail) => (trail.length > 1 ? trail.slice(0, -1) : trail));
  }
}
