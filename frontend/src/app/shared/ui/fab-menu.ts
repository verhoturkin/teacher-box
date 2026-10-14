import {
  ChangeDetectionStrategy,
  Component,
  DOCUMENT,
  ElementRef,
  Injector,
  afterNextRender,
  inject,
  input,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { SHARED_T } from '@shared/i18n/texts';

/** An item of a FAB menu: a link to a page, e.g. the form of a new lesson. */
export interface FabMenuItem {
  readonly label: string;
  /** Icon class without `tb-i`, e.g. `tb-i-account_balance_wallet`. */
  readonly icon: string;
  readonly link: string;
  readonly queryParams?: Readonly<Record<string, string>>;
}

let nextId = 0;

/**
 * The M3 Expressive FAB menu (a phone, above the bottom navigation): the FAB opens a list of up to six
 * actions over it and turns into the round «Закрыть» button. Items — pills of 56 px in the primary
 * container, 4 px apart, 8 px above the button, aligned to its end; they appear one after another.
 * Esc, a tap outside or an item close it; the focus goes to the first item and back to the button.
 */
@Component({
  selector: 'tb-fab-menu',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.tb-fab-menu--open]': 'open()',
    '(document:click)': 'outside($event)',
    '(keydown.escape)': 'close(true)',
  },
  template: `
    @if (open()) {
      <ul class="tb-fab-menu__list" [id]="listId" role="list">
        @for (item of items(); track item.link; let index = $index) {
          <li [style.--tb-fab-index]="items().length - 1 - index">
            <a
              class="tb-fab-menu__item"
              [routerLink]="item.link"
              [queryParams]="item.queryParams"
              (click)="close(false)"
            >
              <i class="tb-i {{ item.icon }}" aria-hidden="true"></i>
              <span>{{ item.label }}</span>
            </a>
          </li>
        }
      </ul>
    }
    <button
      type="button"
      class="tb-fab-menu__button"
      [attr.aria-label]="open() ? closeLabel : label()"
      [attr.aria-expanded]="open()"
      [attr.aria-controls]="listId"
      (click)="toggle()"
    >
      <i class="tb-i" [class.tb-i-add]="!open()" [class.tb-i-close]="open()" aria-hidden="true"></i>
    </button>
  `,
  styles: `
    :host {
      position: fixed;
      right: var(--tb-space-4);
      bottom: calc(var(--tb-bottom-nav-height) + env(safe-area-inset-bottom) + var(--tb-space-4));
      z-index: 900;
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: var(--tb-space-2);
    }

    .tb-fab-menu__list {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: var(--tb-space-1);
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .tb-fab-menu__item {
      display: inline-flex;
      align-items: center;
      gap: var(--tb-space-2);
      height: 3.5rem;
      padding-inline: var(--tb-space-6);
      border-radius: var(--tb-shape-full);
      background: var(--p-md-primary-container);
      color: var(--p-md-on-primary-container);
      box-shadow: var(--tb-elevation-3);
      font: var(--tb-type-title-m);
      letter-spacing: var(--tb-tracking-title-m);
      text-decoration: none;
      white-space: nowrap;
      animation: tb-fab-item-in var(--tb-spring-fast-spatial) both;
      animation-delay: calc(var(--tb-fab-index, 0) * 30ms);

      .tb-i {
        font-size: 1.5rem;
      }

      &:hover {
        background: color-mix(
          in srgb,
          var(--p-md-on-primary-container) var(--tb-state-hover),
          var(--p-md-primary-container)
        );
      }
    }

    .tb-fab-menu__button {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 3.5rem;
      height: 3.5rem;
      border: none;
      border-radius: var(--tb-shape-lg);
      background: var(--p-md-primary-container);
      color: var(--p-md-on-primary-container);
      box-shadow: var(--tb-elevation-3);
      cursor: pointer;
      transition:
        border-radius var(--tb-spring-fast-spatial),
        background var(--tb-spring-fast-effects),
        color var(--tb-spring-fast-effects);

      .tb-i {
        font-size: 1.5rem;
        transition: transform var(--tb-spring-fast-spatial);
      }
    }

    :host(.tb-fab-menu--open) .tb-fab-menu__button {
      border-radius: var(--tb-shape-full);
      background: var(--p-md-primary);
      color: var(--p-md-on-primary);

      .tb-i {
        font-size: 1.25rem;
        transform: rotate(90deg);
      }
    }

    @keyframes tb-fab-item-in {
      from {
        opacity: 0;
        transform: translateY(1rem) scale(0.8);
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .tb-fab-menu__item,
      .tb-fab-menu__button,
      .tb-fab-menu__button .tb-i {
        animation: none;
        transition: none;
      }
    }
  `,
})
export class FabMenu {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly document = inject(DOCUMENT);
  private readonly injector = inject(Injector);
  protected readonly closeLabel = SHARED_T.common.close;
  protected readonly listId = `tb-fab-menu-${String(nextId++)}`;

  readonly items = input.required<readonly FabMenuItem[]>();
  /** The name of the closed FAB, e.g. «Быстрые действия». */
  readonly label = input.required<string>();

  protected readonly open = signal(false);

  protected toggle(): void {
    if (this.open()) {
      this.close(true);
      return;
    }
    this.open.set(true);
    afterNextRender(
      () => {
        this.host.nativeElement.querySelector<HTMLElement>('.tb-fab-menu__item')?.focus();
      },
      { injector: this.injector },
    );
  }

  /** `refocus`: the focus goes back to the FAB (Esc, «Закрыть»), not when an item leads away. */
  close(refocus: boolean): void {
    if (!this.open()) {
      return;
    }
    this.open.set(false);
    if (refocus) {
      this.host.nativeElement.querySelector<HTMLElement>('.tb-fab-menu__button')?.focus();
    }
  }

  protected outside(event: MouseEvent): void {
    const target = event.target;
    if (
      target instanceof Node &&
      this.document.contains(target) &&
      !this.host.nativeElement.contains(target)
    ) {
      this.close(false);
    }
  }
}
