import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { Button } from 'primeng/button';
import { ListRow } from '@shared/ui/list-row';
import { Replay } from '../motion-playback';

/**
 * §1 List rows (415.1): a new row opens its height on the standard fast spring and fades in; a removed row
 * fades out on fast effects and then closes its height, the rows under it close up. The first rows stand still.
 */
@Component({
  selector: 'tb-gallery-list-row-motion',
  imports: [Button, ListRow, Replay],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <tb-gallery-replay [replay]="false" />
    <div class="tb-gallery-row">
      <p-button label="Add a row" icon="tb-i tb-i-add" severity="secondary" (onClick)="add()" />
      <code class="tb-gallery-name">li[tbListRow] — .tb-list-row--enter / .tb-list-row--leave</code>
    </div>
    <ul class="tb-list tb-list--no-lead" aria-label="Rows">
      @for (row of rows(); track row) {
        <li tbListRow>
          <div class="tb-list__text">
            <span class="tb-list__title">Row {{ row }}</span>
            <span class="tb-list__supporting">Supporting text</span>
          </div>
          <div class="tb-list__trail">
            <p-button
              icon="tb-i tb-i-close"
              [text]="true"
              [rounded]="true"
              severity="secondary"
              [ariaLabel]="'Remove row ' + row"
              (onClick)="remove(row)"
            />
          </div>
        </li>
      }
    </ul>
  `,
})
export class ListRowMotionSample {
  private next = 4;
  protected readonly rows = signal([1, 2, 3]);

  protected add(): void {
    const row = this.next++;
    this.rows.update((rows) => [row, ...rows]);
  }

  protected remove(row: number): void {
    this.rows.update((rows) => rows.filter((item) => item !== row));
  }
}
