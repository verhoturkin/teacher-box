import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { map } from 'rxjs';
import { PaneNav, PaneNavItem } from '@shared/ui/pane-nav';
import { SectionNav, SectionNavItem } from '@shared/ui/section-nav';

/**
 * §7 and §10 In-page navigation: `tb-pane-nav` — the list of a list-detail page, linked to `<base>/<id>` (here
 * `/gallery/<section>`); `tb-section-nav` — the contents of a long page, a click scrolls to the section.
 */
@Component({
  selector: 'tb-gallery-navigation',
  imports: [PaneNav, SectionNav],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="tb-gallery-grid nav">
      <div class="tb-gallery-cell">
        <tb-pane-nav [items]="panes" base="/gallery" [current]="current()" label="Parts" />
        <code class="tb-gallery-name">tb-pane-nav [items] base [current] label</code>
      </div>
      <div class="tb-gallery-cell">
        <tb-section-nav [items]="sections" label="Contents" />
        <code class="tb-gallery-name">tb-section-nav [items] label</code>
      </div>
    </div>
  `,
  styles: `
    .nav {
      grid-template-columns: repeat(auto-fill, minmax(18rem, 1fr));
    }
  `,
})
export class NavigationSample {
  protected readonly current = toSignal(
    inject(ActivatedRoute).paramMap.pipe(map((params) => params.get('section'))),
    { initialValue: null },
  );
  protected readonly panes: readonly PaneNavItem[] = [
    { id: 'tokens', icon: 'tb-i-tune', title: 'Tokens', summary: 'Shape, spacing, elevation' },
    {
      id: 'colour',
      icon: 'tb-i-palette',
      title: 'Colour',
      summary: 'Roles in both themes',
      badge: 2,
    },
  ];
  protected readonly sections: readonly SectionNavItem[] = [
    { id: 'tokens', icon: 'tb-i-tune', label: 'Tokens' },
    { id: 'colour', icon: 'tb-i-palette', label: 'Colour' },
  ];
}
