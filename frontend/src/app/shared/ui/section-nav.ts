import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';

let navs = 0;

/** An anchor of {@link SectionNav}: the `id` of the element it scrolls to, its icon class (`tb-i-<name>`) and name. */
export interface SectionNavItem {
  readonly id: string;
  readonly icon: string;
  readonly label: string;
}

/** A button under the anchors («Добавить: Видео»): what the page adds, with its icon class and name. */
export interface SectionNavAction {
  readonly id: string;
  readonly icon: string;
  readonly label: string;
  readonly disabled?: boolean;
}

/** A pressed {@link SectionNavAction} and its click, for a menu that opens beside the button. */
export interface SectionNavPress {
  readonly id: string;
  readonly event: Event;
}

/**
 * The contents of a long page: a one-line M3 navigation-drawer-style list of the page's sections. A click scrolls
 * to the section; the section in view is filled with secondary container (`aria-current`).
 *
 * ```html
 * <tb-section-nav [items]="[{ id: 'task', icon: 'tb-i-description', label: 'Задание' }]" [label]="t.sections" />
 * ```
 */
@Component({
  selector: 'tb-section-nav',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav [attr.aria-label]="label()">
      <ul class="tb-section-nav__list">
        @for (item of items(); track item.id) {
          <li>
            <a
              class="tb-section-nav__item"
              [href]="'#' + item.id"
              [class.tb-section-nav__current]="item.id === current()"
              [attr.aria-current]="item.id === current() ? 'location' : null"
              (click)="go($event, item.id)"
            >
              <i class="tb-i {{ item.icon }}" aria-hidden="true"></i>
              {{ item.label }}
            </a>
          </li>
        }
      </ul>
      @if (actions().length > 0) {
        <div class="tb-section-nav__divider" role="presentation"></div>
        <span class="tb-section-nav__subhead" [id]="subheadId">{{ actionsLabel() }}</span>
        <ul class="tb-section-nav__list" [attr.aria-labelledby]="subheadId">
          @for (action of actions(); track action.id) {
            <li>
              <button
                type="button"
                class="tb-section-nav__item tb-section-nav__action"
                [disabled]="action.disabled ?? false"
                (click)="pressed.emit({ id: action.id, event: $event })"
              >
                <i class="tb-i {{ action.icon }}" aria-hidden="true"></i>
                {{ action.label }}
              </button>
            </li>
          }
        </ul>
      }
    </nav>
  `,
  styles: `
    .tb-section-nav__list {
      display: flex;
      flex-direction: column;
      gap: 2px;
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .tb-section-nav__item {
      display: flex;
      align-items: center;
      gap: var(--tb-space-3);
      min-block-size: 3rem;
      box-sizing: border-box;
      padding: 0 var(--tb-space-4);
      border-radius: var(--tb-shape-full);
      color: var(--p-md-on-surface);
      font: var(--tb-type-label-l);

      &:hover {
        background: color-mix(in srgb, var(--p-md-on-surface) var(--tb-state-hover), transparent);
        text-decoration: none;
      }

      .tb-i {
        font-size: 1.25rem;
        color: var(--p-md-on-surface-variant);
      }
    }

    /* M3 navigation drawer: a divider and a section headline (Title Small) before the second group */
    .tb-section-nav__divider {
      margin: var(--tb-space-2) var(--tb-space-4);
      border-block-start: 1px solid var(--p-md-outline-variant);
    }

    .tb-section-nav__subhead {
      display: block;
      padding: var(--tb-space-2) var(--tb-space-4);
      color: var(--p-md-on-surface-variant);
      font: var(--tb-type-title-s);
    }

    .tb-section-nav__action {
      inline-size: 100%;
      border: 0;
      background: transparent;
      cursor: pointer;
      text-align: start;

      .tb-i {
        color: var(--p-md-primary);
      }

      &:focus-visible {
        outline: 2px solid var(--p-md-secondary);
        outline-offset: 2px;
      }

      &:disabled {
        cursor: default;
        background: transparent;
        color: color-mix(
          in srgb,
          var(--p-md-on-surface) var(--tb-state-disabled-content),
          transparent
        );

        .tb-i {
          color: inherit;
        }
      }
    }

    .tb-section-nav__current,
    .tb-section-nav__current:hover {
      background: var(--p-md-secondary-container);
      color: var(--p-md-on-secondary-container);
      font: var(--tb-type-label-l-emphasized);

      .tb-i {
        color: inherit;
      }
    }
  `,
})
export class SectionNav {
  readonly items = input.required<readonly SectionNavItem[]>();
  readonly label = input.required<string>();
  /** Buttons under the anchors, headed by {@link actionsLabel}. */
  readonly actions = input<readonly SectionNavAction[]>([]);
  readonly actionsLabel = input('');
  readonly pressed = output<SectionNavPress>();
  protected readonly subheadId = `tb-section-nav-${String(++navs)}`;
  protected readonly current = signal('');
  private readonly inView = new Set<string>();

  constructor() {
    const destroyed = inject(DestroyRef);
    effect((onCleanup) => {
      const ids = this.items().map((item) => item.id);
      this.current.set(ids[0] ?? '');
      this.inView.clear();
      if (typeof IntersectionObserver === 'undefined') {
        return;
      }
      // the section whose top part is in the upper half of the screen; the first of them
      const observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) this.inView.add(entry.target.id);
            else this.inView.delete(entry.target.id);
          }
          const first = ids.find((id) => this.inView.has(id));
          if (first !== undefined) this.current.set(first);
        },
        { rootMargin: '0px 0px -50% 0px' },
      );
      for (const id of ids) {
        const element = document.getElementById(id);
        if (element !== null) observer.observe(element);
      }
      onCleanup(() => {
        observer.disconnect();
      });
    });
    destroyed.onDestroy(() => {
      this.inView.clear();
    });
  }

  protected go(event: Event, id: string): void {
    event.preventDefault();
    this.current.set(id);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}
