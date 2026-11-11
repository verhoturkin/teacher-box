import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { MenuItem } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { Menu } from 'primeng/menu';
import { ButtonAttributes } from '@shared/ui/button-attributes';

/**
 * §8 Split button `tb-split`: the main action and a trailing arrow that opens a menu; `tb-split--open` while
 * it is open, `tb-split--m` in the hero. `tbAttributes` gives the arrow `aria-haspopup` and `aria-expanded`.
 */
@Component({
  selector: 'tb-gallery-split-button',
  imports: [ButtonModule, Menu, ButtonAttributes],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="tb-gallery-cell">
      <span
        class="tb-split"
        role="group"
        aria-label="Start the lesson"
        [class.tb-split--open]="open()"
      >
        <p-button styleClass="tb-split__main" label="Start the lesson" icon="tb-i tb-i-videocam" />
        <p-button
          styleClass="tb-split__more"
          icon="tb-i tb-i-expand_more"
          ariaLabel="Other ways"
          [tbAttributes]="{ 'aria-haspopup': 'menu', 'aria-expanded': open() ? 'true' : 'false' }"
          (onClick)="menu.toggle($event)"
        />
        <p-menu
          #menu
          [model]="items"
          [popup]="true"
          appendTo="body"
          (onShow)="open.set(true)"
          (onHide)="open.set(false)"
        />
      </span>
      <code class="tb-gallery-name"
        >span.tb-split > p-button.tb-split__main + p-button.tb-split__more [tbAttributes]</code
      >
    </div>
  `,
})
export class SplitButtonSample {
  protected readonly open = signal(false);
  protected readonly items: MenuItem[] = [
    { label: 'Open in the browser', icon: 'tb-i tb-i-open_in_new' },
  ];
}
