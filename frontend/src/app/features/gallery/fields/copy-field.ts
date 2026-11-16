import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CopyField } from '@shared/ui/copy-field';

/** §9 `tb-copy-field`: a read-only value with a round «Copy» button centred on the field; `mono` for a code. */
@Component({
  selector: 'tb-gallery-copy-field',
  imports: [CopyField],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="tb-gallery-cell">
      <div class="tb-field">
        <label for="gallery-copy-link">Link</label>
        <tb-copy-field inputId="gallery-copy-link" value="https://school.example.com/invite/abc" />
      </div>
      <code class="tb-gallery-name">tb-copy-field [value] [inputId]</code>
    </div>
    <div class="tb-gallery-cell">
      <tb-copy-field value="ABCD-2345" [mono]="true" />
      <code class="tb-gallery-name">tb-copy-field [mono]="true"</code>
    </div>
  `,
})
export class CopyFieldSample {}
