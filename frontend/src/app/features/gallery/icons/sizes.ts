import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { AssistChip } from '@shared/ui/assist-chip';

/**
 * §4 Icon sizes come from the context, never from the icon: 24 px alone and in icon buttons, 20 px in a
 * labelled button, 18 px in a chip (`--tb-icon-size` with `--tb-icon-opsz`); filled only when active or checked.
 */
@Component({
  selector: 'tb-gallery-icon-sizes',
  imports: [ButtonModule, AssistChip],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ul class="tb-gallery-grid">
      <li class="tb-gallery-cell">
        <i class="tb-i tb-i-home" aria-hidden="true"></i>
        <code class="tb-gallery-name">.tb-i — 24 px</code>
      </li>
      <li class="tb-gallery-cell">
        <p-button label="Home" icon="tb-i tb-i-home" severity="secondary" />
        <code class="tb-gallery-name">labelled p-button — 20 px</code>
      </li>
      <li class="tb-gallery-cell">
        <tb-assist-chip icon="home">Home</tb-assist-chip>
        <code class="tb-gallery-name">tb-assist-chip — 18 px</code>
      </li>
      <li class="tb-gallery-cell">
        <i class="tb-i tb-i-home tb-i--filled" aria-hidden="true"></i>
        <code class="tb-gallery-name">.tb-i--filled</code>
      </li>
    </ul>
  `,
})
export class IconSizesSample {}
