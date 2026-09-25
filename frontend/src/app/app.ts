import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Toast } from 'primeng/toast';

@Component({
  selector: 'tb-root',
  imports: [RouterOutlet, Toast],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-toast position="top-right" />
    <router-outlet />
  `,
})
export class App {}
