import { ChangeDetectionStrategy, Component } from '@angular/core';
import { FormControl } from '@angular/forms';
import { MarkdownField, MarkdownMode } from '@shared/ui/markdown-field';

/**
 * `tb-markdown-field`: a Markdown text with «Текст · Просмотр» beside its label (an assignment, a lesson plan);
 * the hint ends with what Markdown can do, the preview keeps the height of the text area.
 */
@Component({
  selector: 'tb-gallery-markdown-field',
  imports: [MarkdownField],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="tb-gallery-cell">
      <tb-markdown-field
        fieldId="gallery-markdown"
        label="Plan"
        hint="Lesson outline, questions and links"
        [control]="text"
        [rows]="5"
      />
      <code class="tb-gallery-name">tb-markdown-field [control] [label] [hint]</code>
    </div>
    <div class="tb-gallery-cell">
      <tb-markdown-field
        fieldId="gallery-markdown-preview"
        label="Preview"
        [control]="text"
        [mode]="preview"
      />
      <code class="tb-gallery-name">tb-markdown-field [mode] — «Просмотр»</code>
    </div>
  `,
})
export class MarkdownFieldSample {
  protected readonly text = new FormControl(
    '# Present Simple\n\n1. **Warm-up** — five questions\n2. *Reading*: p. 12-14\n3. [Video](https://example.com)',
    { nonNullable: true },
  );
  protected readonly preview = new FormControl<MarkdownMode>('preview', { nonNullable: true });
}
