import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';

/** §8 Button variants by weight: one accent; red only destroys. The caption is the PrimeNG markup. */
@Component({
  selector: 'tb-gallery-button-variants',
  imports: [ButtonModule, TooltipModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ul class="tb-gallery-grid">
      <li class="tb-gallery-cell">
        <p-button label="Save" />
        <code class="tb-gallery-name">p-button — filled, main action</code>
      </li>
      <li class="tb-gallery-cell">
        <p-button label="Add" icon="tb-i tb-i-add" severity="secondary" />
        <code class="tb-gallery-name">severity="secondary" — tonal</code>
      </li>
      <li class="tb-gallery-cell">
        <p-button label="Edit" variant="outlined" />
        <code class="tb-gallery-name">variant="outlined"</code>
      </li>
      <li class="tb-gallery-cell">
        <p-button label="Cancel" [text]="true" severity="secondary" />
        <code class="tb-gallery-name">[text]="true" severity="secondary"</code>
      </li>
      <li class="tb-gallery-cell">
        <p-button label="Open" [text]="true" />
        <code class="tb-gallery-name">[text]="true" — labelled row action</code>
      </li>
      <li class="tb-gallery-cell">
        <p-button
          icon="tb-i tb-i-edit"
          [text]="true"
          [rounded]="true"
          severity="secondary"
          ariaLabel="Edit: Anna"
          pTooltip="Edit: Anna"
        />
        <code class="tb-gallery-name">icon, [text] [rounded] secondary + pTooltip</code>
      </li>
      <li class="tb-gallery-cell">
        <p-button
          icon="tb-i tb-i-delete"
          [text]="true"
          [rounded]="true"
          severity="danger"
          ariaLabel="Delete"
        />
        <code class="tb-gallery-name">[text]="true" severity="danger" — delete in a row</code>
      </li>
      <li class="tb-gallery-cell">
        <p-button label="Delete" severity="danger" />
        <code class="tb-gallery-name">severity="danger" — confirm an irreversible action</code>
      </li>
      <li class="tb-gallery-cell">
        <p-button label="Retry" severity="secondary" [loading]="true" />
        <code class="tb-gallery-name">[loading] — the request is on its way</code>
      </li>
      <li class="tb-gallery-cell">
        <p-button label="Save" [disabled]="true" />
        <code class="tb-gallery-name">[disabled]</code>
      </li>
    </ul>
  `,
})
export class ButtonVariantsSample {}
