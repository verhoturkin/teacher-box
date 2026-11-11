import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { MenuItem } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { Menu } from 'primeng/menu';
import { ButtonAttributes } from '@shared/ui/button-attributes';

/**
 * §11 Menus `p-menu [popup]`: tiles 2 px apart, groups split by a separator, the destructive item
 * `styleClass: 'tb-menu-item--danger'`; «⋮» names itself and has `aria-haspopup` / `aria-expanded`.
 */
@Component({
  selector: 'tb-gallery-menu',
  imports: [ButtonModule, Menu, ButtonAttributes],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="tb-gallery-row">
      <p-button
        icon="tb-i tb-i-more_vert"
        [text]="true"
        [rounded]="true"
        severity="secondary"
        ariaLabel="Actions: Anna Petrova"
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
      <code class="tb-gallery-name"
        >p-menu [popup] appendTo="body"; MenuItem separator, styleClass tb-menu-item--danger</code
      >
    </div>
  `,
})
export class MenuSample {
  protected readonly open = signal(false);
  protected readonly items: MenuItem[] = [
    { label: 'Edit', icon: 'tb-i tb-i-edit' },
    { label: 'Copy the link', icon: 'tb-i tb-i-content_copy' },
    { separator: true },
    { label: 'Delete', icon: 'tb-i tb-i-delete', styleClass: 'tb-menu-item--danger' },
  ];
}
