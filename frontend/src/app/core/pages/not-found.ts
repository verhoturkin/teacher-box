import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonDirective, ButtonIcon, ButtonLabel } from 'primeng/button';

@Component({
  selector: 'tb-not-found',
  imports: [RouterLink, ButtonDirective, ButtonIcon, ButtonLabel],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="tb-not-found">
      <h1>404</h1>
      <p>Такой страницы нет.</p>
      <a pButton routerLink="/">
        <i pButtonIcon class="pi pi-home"></i>
        <span pButtonLabel>На главную</span>
      </a>
    </section>
  `,
  styles: `
    .tb-not-found {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1rem;
      padding: 4rem 1rem;
      text-align: center;
    }
    h1 {
      margin: 0;
      font-size: 4rem;
      color: var(--p-primary-color);
    }
  `,
})
export class NotFound {}
