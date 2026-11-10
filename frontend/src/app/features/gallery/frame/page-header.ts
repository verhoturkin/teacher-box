import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { PageHeader } from '@shared/ui/page-header';

/**
 * §7 The page header `tb-page-header`: «back» on a nested page, the title (h1), a line of details (`[meta]`)
 * and the actions on the right, the main one last.
 */
@Component({
  selector: 'tb-gallery-page-header',
  imports: [ButtonModule, PageHeader],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <tb-page-header title="Monthly report" back="/gallery" backLabel="Payments">
      <span meta>October 2026 · 12 lessons</span>
      <p-button label="Download" icon="tb-i tb-i-download" severity="secondary" />
    </tb-page-header>
    <code class="tb-gallery-name">tb-page-header title back backLabel > [meta] + actions</code>
  `,
})
export class PageHeaderSample {}
