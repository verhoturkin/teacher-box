import { Clipboard } from '@angular/cdk/clipboard';
import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { Button } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { Tooltip } from 'primeng/tooltip';
import { Snackbar } from '@core/snackbar/snackbar';
import { SHARED_T } from '@shared/i18n/texts';

/**
 * A read-only field with a round «Копировать» button standing in the middle of it (a button is 40 dp,
 * the field 56 dp) — a link, an address, a one-time code. A snackbar confirms the copy. `mono` sets the
 * value in the monospace face, larger (a code). The label is the caller's `<label [for]="inputId">`.
 *
 * ```html
 * <label for="feed-link">Ссылка</label>
 * <tb-copy-field inputId="feed-link" [value]="link" [copyLabel]="t.copy" [copiedText]="t.copied" />
 * ```
 */
@Component({
  selector: 'tb-copy-field',
  imports: [Button, InputText, Tooltip],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: block' },
  template: `
    <div class="tb-copy-row">
      <input
        pInputText
        class="tb-grow"
        [class.tb-copy-field__mono]="mono()"
        [id]="inputId()"
        [value]="value()"
        readonly
      />
      <p-button
        icon="tb-i tb-i-content_copy"
        severity="secondary"
        [text]="true"
        [rounded]="true"
        [pTooltip]="copyLabel()"
        [ariaLabel]="copyLabel()"
        (onClick)="copy()"
      />
    </div>
  `,
  styles: `
    .tb-copy-field__mono {
      font-family: var(--tb-font-mono);
      font-size: 1.5rem;
      letter-spacing: 0.15em;
    }
  `,
})
export class CopyField {
  private readonly clipboard = inject(Clipboard);
  private readonly snackbar = inject(Snackbar);

  readonly value = input.required<string>();
  /** The `id` of the input, for the caller's `<label for>`. */
  readonly inputId = input<string | null>(null);
  readonly copyLabel = input<string>(SHARED_T.common.copy);
  /** The snackbar text after the copy. */
  readonly copiedText = input<string>(SHARED_T.common.copied);
  readonly mono = input(false);

  protected copy(): void {
    if (this.clipboard.copy(this.value())) {
      this.snackbar.success(this.copiedText());
    }
  }
}
