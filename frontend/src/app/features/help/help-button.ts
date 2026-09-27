import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Button } from 'primeng/button';
import { Drawer } from 'primeng/drawer';
import { HelpArticleView } from './help-article-view';
import { HelpLibrary } from './help-library';
import { HelpArticle } from './help.models';
import { HelpTopic, helpUrl } from './help-topics';

/**
 * «?» (or «Подробнее») next to a heading: opens the help article in a side panel without leaving
 * the page.
 */
@Component({
  selector: 'tb-help-button',
  imports: [RouterLink, Button, Drawer, HelpArticleView],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (label(); as text) {
      <p-button [label]="text" icon="pi pi-question-circle" [link]="true" size="small" (onClick)="open()" />
    } @else {
      <p-button
        icon="pi pi-question-circle"
        [text]="true"
        [rounded]="true"
        severity="secondary"
        ariaLabel="Справка"
        (onClick)="open()"
      />
    }
    <p-drawer [(visible)]="visible" position="right" appendTo="body" [header]="article()?.title ?? 'Справка'" styleClass="tb-help-drawer">
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

  async open(): Promise<void> {
    this.article.set(await this.library.article(this.topic()));
    this.visible.set(true);
  }
}
