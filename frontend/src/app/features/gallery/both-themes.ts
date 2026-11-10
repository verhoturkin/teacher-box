import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, TemplateRef, input } from '@angular/core';
import { DARK_CLASS } from '@core/theme/theme-mode';

/**
 * A sample in both themes side by side: the template once on the light roles and once inside the dark class
 * of the portal (`tb-dark`), which brings the dark roles to its subtree.
 *
 * `<ng-template #roles>…</ng-template> <tb-gallery-both-themes [sample]="roles" />`
 */
@Component({
  selector: 'tb-gallery-both-themes',
  imports: [NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="theme theme--light">
      <code class="tb-gallery-name">light</code>
      <ng-container [ngTemplateOutlet]="sample()" />
    </div>
    <div class="theme" [class]="dark">
      <code class="tb-gallery-name">.{{ dark }}</code>
      <ng-container [ngTemplateOutlet]="sample()" />
    </div>
  `,
  styles: `
    :host {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
      gap: var(--tb-space-4);
    }

    .theme {
      display: flex;
      flex-direction: column;
      gap: var(--tb-space-3);
      padding: var(--tb-space-4);
      border-radius: var(--tb-shape-lg);
      background: var(--p-md-surface);
      color: var(--p-md-on-surface);
    }
  `,
})
export class BothThemes {
  readonly sample = input.required<TemplateRef<unknown>>();
  protected readonly dark = DARK_CLASS;
}
