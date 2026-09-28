import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { Router } from '@angular/router';
import { renderMarkdown } from '@shared/ui/markdown-view';

/** The text of an article; links inside the portal open without reloading the page. */
@Component({
  selector: 'tb-help-article',
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Clicks on the links of the text (a link is activated from the keyboard with a click as well).
  host: { '(click)': 'follow($event)' },
  template: `<div class="tb-markdown tb-help-article" [innerHTML]="html()"></div>`,
  styles: `
    .tb-help-article {
      line-height: 1.6;
    }
  `,
})
export class HelpArticleView {
  private readonly router = inject(Router);

  readonly body = input('');
  /** A link inside the portal was followed. */
  readonly navigated = output<string>();

  protected readonly html = computed(() => renderMarkdown(this.body()));

  follow(event: MouseEvent): void {
    const target = event.target;
    const link = target instanceof Element ? target.closest('a') : null;
    const href = link?.getAttribute('href') ?? null;
    if (
      href === null ||
      !href.startsWith('/') ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey
    ) {
      return;
    }
    event.preventDefault();
    void this.router.navigateByUrl(href);
    this.navigated.emit(href);
  }
}
