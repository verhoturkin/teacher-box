import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { Observable, of } from 'rxjs';
import { Card } from 'primeng/card';
import { FoldCard } from '@shared/ui/fold-card';
import { MaterialCard } from '@shared/ui/material-card';

const PREVIEW =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 50"><rect width="80" height="50" fill="rgb(200 210 255)"/><circle cx="25" cy="25" r="12" fill="rgb(90 100 220)"/></svg>';

/**
 * §10 Cards: `tb-material-card` in `tb-material-grid` (a preview loaded by `tb-blob-image`, the kind's icon
 * while there is none; `[tonal]` for an external board), the outlined `p-card.tb-section-card` of a settings
 * group and the folding `tb-fold-card`, whose content is rendered only when it is open.
 */
@Component({
  selector: 'tb-gallery-cards',
  imports: [Card, FoldCard, MaterialCard],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ul class="tb-material-grid" aria-label="Materials">
      <li>
        <tb-material-card
          title="Irregular verbs"
          supporting="Anna · 12.10"
          icon="tb-i-co_present"
          actionsLabel="Actions: Irregular verbs"
          [loader]="preview"
          ref="verbs"
        />
      </li>
      <li>
        <tb-material-card title="Present Perfect" supporting="All · 03.10" icon="tb-i-menu_book" />
      </li>
      <li>
        <tb-material-card
          title="Miro board"
          supporting="Ivan · 01.10"
          icon="tb-i-open_in_new"
          [tonal]="true"
          tag="Miro"
        />
      </li>
    </ul>
    <code class="tb-gallery-name"
      >ul.tb-material-grid > li > tb-material-card [tonal] [tag] [actionsLabel]</code
    >
    <p-card header="Portal" styleClass="tb-section-card">
      <p>An outlined card of a settings group.</p>
    </p-card>
    <code class="tb-gallery-name">p-card styleClass="tb-section-card"</code>
    <tb-fold-card title="Messengers" summary="Bots and your messengers" [badge]="1" [(open)]="open">
      <ng-template><p>The content is rendered when the card opens.</p></ng-template>
    </tb-fold-card>
    <code class="tb-gallery-name">tb-fold-card title summary [badge] [(open)] > ng-template</code>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: var(--tb-space-3);
    }
  `,
})
export class CardsSample {
  protected readonly open = signal(false);
  /** A preview as the API gives it: a blob, here a small picture made on the spot. */
  protected readonly preview = (): Observable<Blob> =>
    of(new Blob([PREVIEW], { type: 'image/svg+xml' }));
}
