import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';

/** An anchor of {@link SectionNav}: the `id` of the element it scrolls to, its icon (`tb-i-<name>`) and name. */
export interface SectionNavItem {
  readonly id: string;
  readonly icon: string;
  readonly label: string;
}

/**
 * The contents of a long page: a one-line M3 navigation-drawer-style list of the page's sections. A click scrolls
 * to the section; the section in view is filled with secondary container (`aria-current`).
 *
 * ```html
 * <tb-section-nav [items]="[{ id: 'task', icon: 'description', label: 'Задание' }]" [label]="t.sections" />
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
              <i class="tb-i tb-i-{{ item.icon }}" aria-hidden="true"></i>
              {{ item.label }}
            </a>
          </li>
        }
      </ul>
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
