import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MarkdownView } from '@shared/ui/markdown-view';

const TEXT = `## Present Perfect

Write **five** sentences about your week. Use *already* and *yet*.

1. I have already finished…
2. She hasn't called yet…

See [the rule](https://example.org) and \`have + V3\`.`;

/** §3 Markdown of assignments and answers `tb-markdown`: sanitized, `#` is h3 under the section's h2. */
@Component({
  selector: 'tb-gallery-markdown',
  imports: [MarkdownView],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <tb-markdown [text]="text" />
    <code class="tb-gallery-name">tb-markdown [text]</code>
  `,
})
export class MarkdownSample {
  protected readonly text = TEXT;
}
