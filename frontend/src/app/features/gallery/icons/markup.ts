import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { EmptyState } from '@shared/ui/empty-state';

/** §4 Icons: the three ways to put a Material Symbol; the class names the symbol and is written whole. */
@Component({
  selector: 'tb-gallery-icon-markup',
  imports: [ButtonModule, EmptyState],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ul class="tb-gallery-grid">
      <li class="tb-gallery-cell">
        <i class="tb-i tb-i-calendar_month" aria-hidden="true"></i>
        <code class="tb-gallery-name"
          >&lt;i class="tb-i tb-i-calendar_month" aria-hidden="true"&gt;</code
        >
      </li>
      <li class="tb-gallery-cell">
        <p-button label="Schedule" icon="tb-i tb-i-calendar_month" severity="secondary" />
        <code class="tb-gallery-name">p-button icon="tb-i tb-i-calendar_month"</code>
      </li>
      <li class="tb-gallery-cell">
        <tb-empty-state icon="tb-i-calendar_month" title="No lessons yet" [compact]="true" />
        <code class="tb-gallery-name">tb-empty-state icon="tb-i-calendar_month"</code>
      </li>
      <li class="tb-gallery-cell">
        <i class="tb-i tb-i-progress_activity tb-i--spin" aria-hidden="true"></i>
        <code class="tb-gallery-name">tb-i-progress_activity tb-i--spin</code>
      </li>
    </ul>
  `,
})
export class IconMarkupSample {}
