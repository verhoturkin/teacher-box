import {
  ChangeDetectionStrategy,
  Component,
  DOCUMENT,
  ElementRef,
  Injector,
  afterNextRender,
  inject,
  computed,
  input,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { SHARED_T } from '@shared/i18n/texts';

/**
 * An item of a FAB menu: a link to a page (e.g. the form of a new lesson) or an action on the page itself
 * (`run`, e.g. a dialog over it).
 */
export type FabMenuItem = {
  readonly label: string;
  /** Icon class without `tb-i`, e.g. `tb-i-account_balance_wallet`. */
  readonly icon: string;
} & (
  | { readonly link: string; readonly queryParams?: Readonly<Record<string, string>> }
  | { readonly run: () => void }
);

/**
 * Where the FAB stands: `phone` — fixed above the bottom navigation, the list over it; `rail` — the FAB at
 * the top of the collapsed rail; `extended` — the small extended FAB (icon + label) at the top of the
 * expanded rail. In the rail the FAB rests at elevation 0 (M3 nav rail) and the list opens under it.
 */
export type FabMenuVariant = 'phone' | 'rail' | 'extended';

let nextId = 0;

/**
 * The M3 Expressive FAB menu: the FAB opens a list of up to six actions. On a phone (above the bottom
 * navigation) the list stands over it and the FAB turns into the round «Закрыть» button; in the rail
 * (ADR-0048, «Создать») the list opens under the FAB, over the page, and the FAB keeps its place and
 * label with the close icon. Items — pills of 56 px in the primary container, 4 px apart, 8 px from the
 * button; they appear one after another. Esc, a tap outside, the focus leaving or an item close it; the
 * focus goes to the first item and back to the button; ↓ ↑ Home End move between the items.
 */
@Component({
  selector: 'tb-fab-menu',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.tb-fab-menu--open]': 'open()',
    '[class.tb-fab-menu--rail]': "variant() !== 'phone'",
    '[class.tb-fab-menu--extended]': 'extended()',
    '(document:click)': 'outside($event)',
    '(window:resize)': 'close(false)',
    '(keydown.escape)': 'close(true)',
    '(keydown)': 'move($event)',
    '(focusout)': 'focusOut($event)',
  },
  template: `
    <!-- the button first: Tab goes from it into the list (on a phone the list stands over it, CSS) -->
    <button
      type="button"
      class="tb-fab-menu__button"
      [attr.aria-label]="extended() ? null : open() ? closeLabel : label()"
      [attr.aria-expanded]="open()"
      [attr.aria-controls]="listId"
      (click)="toggle()"
    >
      <i class="tb-i" [class.tb-i-add]="!open()" [class.tb-i-close]="open()" aria-hidden="true"></i>
      @if (extended()) {
        <span class="tb-fab-menu__label">{{ label() }}</span>
      }
    </button>
    @if (open()) {
      <ul
        class="tb-fab-menu__list"
        animate.leave="tb-fab-menu__list--leave"
        [id]="listId"
        role="list"
        [style.top.px]="position()?.top"
        [style.left.px]="position()?.left"
      >
        @for (item of items(); track item.label; let index = $index) {
          <li [style.--tb-fab-index]="variant() === 'phone' ? items().length - 1 - index : index">
            @if ('link' in item) {
              <a
                class="tb-fab-menu__item"
                [routerLink]="item.link"
                [queryParams]="item.queryParams"
                (click)="close(false)"
              >
                <i class="tb-i {{ item.icon }}" aria-hidden="true"></i>
                <span>{{ item.label }}</span>
              </a>
            } @else {
              <button type="button" class="tb-fab-menu__item" (click)="close(true); item.run()">
                <i class="tb-i {{ item.icon }}" aria-hidden="true"></i>
                <span>{{ item.label }}</span>
              </button>
            }
          </li>
        }
      </ul>
    }
  `,
  styles: `
    :host {
      position: fixed;
      right: var(--tb-space-4);
      bottom: calc(var(--tb-bottom-nav-height) + env(safe-area-inset-bottom) + var(--tb-space-4));
      z-index: 900;
      display: flex;
      flex-direction: column-reverse;
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
      /* an action item is a button that looks like the links */
      border: 0;
      cursor: pointer;
      animation: tb-fab-item-in var(--tb-spring-fast-spatial) both;
      animation-delay: calc(var(--tb-fab-index, 0) * 30ms);

      .tb-i {
        font-size: 1.5rem;
      }

      transition:
        transform var(--tb-spring-fast-spatial),
        background var(--tb-spring-fast-effects);

      &:hover {
        background: color-mix(
          in srgb,
          var(--p-md-on-primary-container) var(--tb-state-hover),
          var(--p-md-primary-container)
        );
      }

      &:focus-visible,
      &:active {
        background: color-mix(
          in srgb,
          var(--p-md-on-primary-container) var(--tb-state-pressed),
          var(--p-md-primary-container)
        );
      }

      &:active {
        transform: scale(0.96);
      }
    }

    /*
     * M3E FAB motion: the corner, the size and the elevation move on spatial springs (pressed: the corner
     * morphs from large to medium and the button shrinks to 96 %; hovered: elevation 4), the state layer (hover 8 %,
     * focus and pressed 10 %) and colours on effects springs. The icon turns on a spatial spring when it swaps.
     */
    .tb-fab-menu__button {
      position: relative;
      isolation: isolate;
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
        transform var(--tb-spring-fast-spatial),
        box-shadow var(--tb-spring-fast-effects),
        background var(--tb-spring-fast-effects),
        color var(--tb-spring-fast-effects);

      /* the state layer */
      &::before {
        content: '';
        position: absolute;
        inset: 0;
        z-index: -1;
        border-radius: inherit;
        background: currentColor;
        opacity: 0;
        transition: opacity var(--tb-spring-fast-effects);
      }

      &:hover::before {
        opacity: var(--tb-state-hover);
      }

      &:focus-visible::before,
      &:active::before {
        opacity: var(--tb-state-pressed);
      }

      &:hover {
        box-shadow: var(--tb-elevation-4);
      }

      &:active {
        border-radius: var(--tb-shape-md);
        transform: scale(0.96);
      }

      .tb-i {
        font-size: 1.5rem;
        transition: transform var(--tb-spring-fast-spatial);
      }
    }

    :host(.tb-fab-menu--open) .tb-fab-menu__button .tb-i {
      transform: rotate(90deg);
    }

    :host(.tb-fab-menu--open:not(.tb-fab-menu--rail)) .tb-fab-menu__button {
      border-radius: var(--tb-shape-full);
      background: var(--p-md-primary);
      color: var(--p-md-on-primary);

      .tb-i {
        font-size: 1.25rem;
      }
    }

    .tb-fab-menu__button:focus-visible {
      outline: 3px solid var(--p-md-secondary);
      outline-offset: 2px;
    }

    /*
     * In the rail (spec §3.1): the FAB 56 px, corner large, or the small extended FAB (56 px, corner large,
     * 16 px before and after, 8 px between the icon and the label, Title Medium); nested in the rail it
     * rests at elevation 0 (M3 nav rail), hover is the state layer. Ours: the list is fixed under the FAB,
     * 8 px below it, aligned to its start, so the scrolling rail does not clip it.
     */
    :host(.tb-fab-menu--rail) {
      position: static;
      z-index: auto;
      flex-direction: column;
      align-items: flex-start;

      .tb-fab-menu__button,
      .tb-fab-menu__button:hover {
        box-shadow: none;
      }

      .tb-fab-menu__list {
        position: fixed;
        z-index: 1100;
        align-items: flex-start;
      }

      .tb-fab-menu__item {
        animation-name: tb-fab-item-down;
      }
    }

    :host(.tb-fab-menu--extended) .tb-fab-menu__button {
      gap: var(--tb-space-2);
      width: auto;
      padding-inline: var(--tb-space-4);
      font: var(--tb-type-title-m);
      letter-spacing: var(--tb-tracking-title-m);
    }

    /* the list leaves on an effects spring and a short spatial move toward the button */
    .tb-fab-menu__list--leave {
      animation:
        tb-fab-list-out var(--tb-spring-fast-effects) forwards,
        tb-fab-list-shrink var(--tb-spring-fast-spatial) forwards;
    }

    @keyframes tb-fab-list-out {
      to {
        opacity: 0;
      }
    }

    @keyframes tb-fab-list-shrink {
      to {
        transform: translateY(0.5rem) scale(0.9);
      }
    }

    @keyframes tb-fab-item-down {
      from {
        opacity: 0;
        transform: translateY(-1rem) scale(0.8);
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
      .tb-fab-menu__list,
      .tb-fab-menu__button,
      .tb-fab-menu__button::before,
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
  /** The name of the closed FAB, e.g. «Быстрые действия»; the visible label of the extended FAB. */
  readonly label = input.required<string>();
  readonly variant = input<FabMenuVariant>('phone');

  protected readonly open = signal(false);
  protected readonly extended = computed(() => this.variant() === 'extended');
  /** In the rail: where the list stands, under the FAB (pixels of the viewport). */
  protected readonly position = signal<{ top: number; left: number } | null>(null);

  protected toggle(): void {
    if (this.open()) {
      this.close(true);
      return;
    }
    if (this.variant() !== 'phone') {
      const rect = this.button().getBoundingClientRect();
      this.position.set({ top: rect.bottom + 8, left: rect.left });
    }
    this.open.set(true);
    afterNextRender(
      () => {
        this.host.nativeElement.querySelector<HTMLElement>('.tb-fab-menu__item')?.focus();
      },
      { injector: this.injector },
    );
  }

  /**
   * `refocus`: the focus goes back to the FAB (Esc, «Закрыть», an action over the page), not when an item
   * leads away.
   */
  close(refocus: boolean): void {
    if (!this.open()) {
      return;
    }
    this.open.set(false);
    if (refocus) {
      this.button().focus();
    }
  }

  /** ↓ ↑ Home End between the items of the open list (links and buttons: Tab works as well). */
  protected move(event: KeyboardEvent): void {
    const links = Array.from(
      this.host.nativeElement.querySelectorAll<HTMLElement>('.tb-fab-menu__item'),
    );
    const active = this.document.activeElement;
    const current = links.findIndex((link) => link === active);
    const last = links.length - 1;
    const next: Partial<Record<string, number>> = {
      ArrowDown: current === last ? 0 : current + 1,
      ArrowUp: current <= 0 ? last : current - 1,
      Home: 0,
      End: last,
    };
    const target = links[next[event.key] ?? -1];
    if (target !== undefined) {
      event.preventDefault();
      target.focus();
    }
  }

  /** The focus has left the FAB and its list (Tab past the last item): the list closes. */
  protected focusOut(event: FocusEvent): void {
    const target = event.relatedTarget;
    if (target instanceof Node && !this.host.nativeElement.contains(target)) {
      this.close(false);
    }
  }

  private button(): HTMLElement {
    return requireButton(this.host.nativeElement);
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

function requireButton(host: HTMLElement): HTMLElement {
  const button = host.querySelector<HTMLElement>('.tb-fab-menu__button');
  if (button === null) {
    throw new Error('FAB menu without its button');
  }
  return button;
}
