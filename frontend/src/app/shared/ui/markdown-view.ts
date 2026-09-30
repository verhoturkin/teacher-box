import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { marked } from 'marked';

/**
 * Markdown to HTML. The result is bound via [innerHTML], so Angular sanitizes it (no scripts,
 * handlers, js: links). `levels` moves the headings down: the text lies under a heading of its own
 * (a section h2, an article), so its `#` is not a heading of the same level (ADR-0024).
 */
export function renderMarkdown(text: string, levels = 0): string {
  const html = marked.parse(text, { async: false, gfm: true, breaks: true });
  return levels === 0
    ? html
    : html.replace(
        /<(\/?)h([1-6])(?=[\s>])/g,
        (_tag, slash: string, level: string) =>
          `<${slash}h${String(Math.min(6, Number(level) + levels))}`,
      );
}

/** Renders Markdown text (assignment descriptions, answers) inside a section: `#` is h3. */
@Component({
  selector: 'tb-markdown',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="tb-markdown" [innerHTML]="html()"></div>`,
})
export class MarkdownView {
  readonly text = input<string | null>(null);

  protected readonly html = computed(() => renderMarkdown(this.text() ?? '', 2));
}
