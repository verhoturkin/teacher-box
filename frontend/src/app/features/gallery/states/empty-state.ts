import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { EmptyState } from '@shared/ui/empty-state';

/**
 * §12 The empty state `tb-empty-state`: an icon, what is empty, what will appear and the first action as
 * content (none when the same action is the FAB); `[compact]` — a widget, the calendar, a dialog.
 */
@Component({
  selector: 'tb-gallery-empty-state',
  imports: [ButtonModule, EmptyState],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ul class="tb-gallery-grid">
      <li class="tb-gallery-cell">
        <tb-empty-state
          icon="tb-i-assignment"
          title="No assignments yet"
          hint="Assignments you give out appear here"
        >
          <p-button label="New assignment" icon="tb-i tb-i-add" severity="secondary" />
        </tb-empty-state>
        <code class="tb-gallery-name">tb-empty-state icon title hint > p-button</code>
      </li>
      <li class="tb-gallery-cell">
        <tb-empty-state icon="tb-i-calendar_month" title="No lessons today" [compact]="true" />
        <code class="tb-gallery-name">tb-empty-state [compact]="true"</code>
      </li>
    </ul>
  `,
})
export class EmptyStateSample {}
