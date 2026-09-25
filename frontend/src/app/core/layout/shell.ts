import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { MenuItem } from 'primeng/api';
import { Menubar } from 'primeng/menubar';

/** Application frame: top navigation bar and routed content. */
@Component({
  selector: 'tb-shell',
  imports: [Menubar, RouterOutlet, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-menubar [model]="items()" styleClass="tb-shell__bar">
      <ng-template #start>
        <a class="tb-shell__brand" [routerLink]="homeLink()">
          <i class="pi pi-graduation-cap" aria-hidden="true"></i>
          <span>Teacher Box</span>
        </a>
      </ng-template>
      <ng-template #end>
        <span class="tb-shell__area">{{ areaTitle() }}</span>
      </ng-template>
    </p-menubar>
    <main class="tb-shell__content">
      <router-outlet />
    </main>
  `,
  styleUrl: './shell.scss',
})
export class Shell {
  readonly items = input.required<MenuItem[]>();
  readonly homeLink = input.required<string>();
  readonly areaTitle = input.required<string>();
}
