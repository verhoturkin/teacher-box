import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { marked } from 'marked';

/** Markdown to HTML. The result is bound via [innerHTML], so Angular sanitizes it (no scripts, handlers, js: links). */
export function renderMarkdown(text: string): string {
  return marked.parse(text, { async: false, gfm: true, breaks: true });
}

/** Renders Markdown text (assignment descriptions, answers). */
@Component({
  selector: 'tb-markdown',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="tb-markdown" [innerHTML]="html()"></div>`,
})
export class MarkdownView {
  readonly text = input<string | null>(null);

  protected readonly html = computed(() => renderMarkdown(this.text() ?? ''));
}
