import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { Segment, SegmentGroup } from '@shared/ui/segment-group';

type View = 'list' | 'students';

/**
 * §8 Button groups. Standard `tb-button-group` — actions side by side; connected `tb-button-group--connected`
 * and `tb-segment-group` — toggles only (a value, a view, a filter); `[outlined]` — the M3 segmented buttons.
 */
@Component({
  selector: 'tb-gallery-button-groups',
  imports: [ButtonModule, SegmentGroup],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ul class="tb-gallery-cell">
      <li class="tb-gallery-cell">
        <div class="tb-button-group" role="group" aria-label="Requests">
          <p-button label="Reschedule" severity="secondary" />
          <p-button label="I will not come" severity="secondary" />
        </div>
        <code class="tb-gallery-name">div.tb-button-group[role=group] — actions</code>
      </li>
      <li class="tb-gallery-cell">
        <tb-segment-group label="View" [segments]="views" [(value)]="view" />
        <code class="tb-gallery-name">tb-segment-group — a toggle, tonal</code>
      </li>
      <li class="tb-gallery-cell">
        <tb-segment-group label="View" [segments]="views" [(value)]="view" [outlined]="true" />
        <code class="tb-gallery-name">tb-segment-group [outlined]="true"</code>
      </li>
      <li class="tb-gallery-cell">
        <tb-segment-group
          label="Filter"
          [segments]="filters"
          [(value)]="filter"
          [outlined]="true"
          [checkmark]="false"
        />
        <code class="tb-gallery-name">[outlined]="true" [checkmark]="false", with counts</code>
      </li>
    </ul>
  `,
})
export class ButtonGroupsSample {
  protected readonly views: readonly Segment<View>[] = [
    { value: 'list', label: 'As a list' },
    { value: 'students', label: 'By student' },
  ];
  protected readonly view = signal<View>('list');
  protected readonly filters: readonly Segment<string>[] = [
    { value: 'active', label: 'Active', count: 4 },
    { value: 'drafts', label: 'Drafts', count: 1 },
    { value: 'done', label: 'Done', count: 12 },
  ];
  protected readonly filter = signal('active');
}
