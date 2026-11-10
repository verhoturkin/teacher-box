import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { ButtonModule } from 'primeng/button';

/** §8 Sizes: 40 px by default, M (56 px) only in the hero; a label that changes keeps its width. */
@Component({
  selector: 'tb-gallery-button-sizes',
  imports: [ButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ul class="tb-gallery-grid">
      <li class="tb-gallery-cell">
        <p-button label="Join" icon="tb-i tb-i-videocam" />
        <code class="tb-gallery-name">p-button — 40 px</code>
      </li>
      <li class="tb-gallery-cell">
        <p-button label="Join" icon="tb-i tb-i-videocam" styleClass="tb-button-m" />
        <code class="tb-gallery-name">styleClass="tb-button-m" — 56 px, the hero</code>
      </li>
      <li class="tb-gallery-cell">
        <p-button
          class="tb-button-steady"
          severity="secondary"
          [label]="coming() ? 'Cancel' : 'I will not come'"
          (onClick)="coming.set(!coming())"
        />
        <code class="tb-gallery-name">p-button class="tb-button-steady" — press it</code>
      </li>
    </ul>
  `,
})
export class ButtonSizesSample {
  protected readonly coming = signal(true);
}
