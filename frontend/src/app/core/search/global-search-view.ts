import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  model,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CORE_T } from '@core/i18n/texts';
import { GlobalSearch, SearchGroup } from './search';

const T = CORE_T.search;

const GROUP_ICONS: Readonly<Record<SearchGroup, string>> = {
  students: 'tb-i-person',
  groups: 'tb-i-group',
  assignments: 'tb-i-assignment',
  boards: 'tb-i-dashboard',
  textbooks: 'tb-i-library_books',
};

const FOCUSABLE = 'button:not([disabled]), input:not([disabled])';

let nextId = 0;

/** The hint chip of the shortcut: ⌘ K on a Mac, Ctrl K elsewhere. */
function shortcutHint(): string {
  return typeof navigator !== 'undefined' && /mac|iphone|ipad/i.test(navigator.userAgent)
    ? '⌘ K'
    : 'Ctrl K';
}

/**
 * The teacher's global search (spec §2, D6; `GlobalSearch` holds the data). Two shapes of one component: the
 * M3 docked search bar of the top strip with the results in a dropdown search view under it, and — on compact —
 * the full-screen search view that the search icon of the top app bar opens (`full`, `open`).
 *
 * A combobox over a listbox: the focus stays in the field, ↑ ↓ move the active result, Enter opens it, Esc closes
 * the results (a second Esc clears the field). The full-screen view is a dialog; it gives the focus back to what
 * opened it.
 */
@Component({
  selector: 'tb-global-search',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.tb-search--full]': 'full()',
    '(focusout)': 'leave($event)',
    '(keydown)': 'trap($event)',
  },
  template: `
    @if (!full() || open()) {
      <div
        class="tb-search"
        [class.tb-search--open]="panelOpen()"
        [attr.role]="full() ? 'dialog' : null"
        [attr.aria-modal]="full() ? 'true' : null"
        [attr.aria-label]="full() ? t.label : null"
      >
        <div class="tb-search__bar">
          @if (full()) {
            <button
              type="button"
              class="tb-search__icon-button"
              [attr.aria-label]="t.back"
              (click)="close()"
            >
              <i class="tb-i tb-i-arrow_back" aria-hidden="true"></i>
            </button>
          } @else {
            <i class="tb-i tb-i-search tb-search__lead" aria-hidden="true"></i>
          }
          <input
            #field
            class="tb-search__input"
            type="text"
            role="combobox"
            autocomplete="off"
            spellcheck="false"
            enterkeyhint="search"
            aria-autocomplete="list"
            aria-haspopup="listbox"
            [attr.aria-controls]="listId"
            [attr.aria-expanded]="panelOpen()"
            [attr.aria-activedescendant]="activeId()"
            [attr.aria-label]="t.label"
            [placeholder]="t.placeholder"
            [value]="search.query()"
            (focus)="opened()"
            (click)="opened()"
            (input)="type(field.value)"
            (keydown)="key($event)"
          />
          @if (search.query() !== '') {
            <button
              type="button"
              class="tb-search__icon-button"
              [attr.aria-label]="t.clear"
              (click)="clear()"
            >
              <i class="tb-i tb-i-close" aria-hidden="true"></i>
            </button>
          } @else if (!full()) {
            <kbd class="tb-search__shortcut" aria-hidden="true">{{ shortcut }}</kbd>
          }
        </div>
        @if (panelOpen()) {
          <!-- the field keeps the focus when a result is pressed: the press must not blur it first -->
          <div class="tb-search__panel" (mousedown)="$event.preventDefault()">
            @if (groups().length > 0) {
              <div
                class="tb-search__list"
                role="listbox"
                [id]="listId"
                [attr.aria-label]="t.results"
              >
                @for (group of groups(); track group.group) {
                  <div role="group" [attr.aria-labelledby]="listId + '-' + group.group">
                    <div
                      class="tb-search__group"
                      role="presentation"
                      [id]="listId + '-' + group.group"
                    >
                      {{ group.label }}
                    </div>
                    @for (item of group.items; track item.entry.id) {
                      <a
                        class="tb-search__option"
                        role="option"
                        tabindex="-1"
                        [id]="optionId(item.index)"
                        [class.tb-search__option--active]="item.index === active()"
                        [attr.aria-selected]="item.index === active()"
                        [routerLink]="item.entry.link"
                        [queryParams]="item.entry.query"
                        (click)="picked()"
                        (mousemove)="active.set(item.index)"
                      >
                        <i
                          class="tb-i {{ group.icon }} tb-search__option-icon"
                          aria-hidden="true"
                        ></i>
                        <span class="tb-search__option-text">
                          <span class="tb-search__option-title">{{ item.entry.title }}</span>
                          @if (item.entry.subtitle; as subtitle) {
                            <span class="tb-search__option-subtitle">{{ subtitle }}</span>
                          }
                        </span>
                      </a>
                    }
                    @if (group.total > group.items.length) {
                      <div class="tb-search__more" role="presentation">
                        {{ t.more(group.total - group.items.length) }}
                      </div>
                    }
                  </div>
                }
              </div>
            } @else {
              <p class="tb-search__state" role="status">
                @if (search.loading()) {
                  {{ t.loading }}
                } @else if (search.query().trim() === '') {
                  {{ t.hint }}
                } @else {
                  {{ t.none(search.query().trim()) }}
                }
              </p>
            }
            @if (failedGroups(); as failed) {
              <p class="tb-search__state tb-search__state--error" role="status">
                {{ t.failed(failed) }}
              </p>
            }
          </div>
        }
      </div>
    }
  `,
  styleUrl: './global-search-view.scss',
})
export class GlobalSearchView {
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);
  private readonly injector = inject(Injector);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly field = viewChild<ElementRef<HTMLInputElement>>('field');
  private opener: HTMLElement | null = null;

  protected readonly t = T;
  protected readonly search = inject(GlobalSearch);
  protected readonly shortcut = shortcutHint();
  protected readonly listId = `tb-search-${String(nextId++)}`;

  /** The full-screen search view of the compact top app bar instead of the bar of the top strip. */
  readonly full = input(false);
  /** The full-screen view is open (`full` only). */
  readonly open = model(false);

  /** The results under the bar are shown (the bar only; the full-screen view always shows them). */
  private readonly expanded = signal(false);
  protected readonly panelOpen = computed(() => (this.full() ? this.open() : this.expanded()));
  /** The active result (the one Enter opens), counted over all groups. */
  protected readonly active = signal(0);

  protected readonly groups = computed(() => {
    let index = 0;
    return this.search.results().map((group) => ({
      group: group.group,
      label: T.groups[group.group],
      icon: GROUP_ICONS[group.group],
      total: group.total,
      items: group.entries.map((entry) => ({ entry, index: index++ })),
    }));
  });
  private readonly flat = computed(() => this.groups().flatMap((group) => group.items));
  protected readonly activeId = computed(() =>
    this.panelOpen() && this.flat().length > 0 ? this.optionId(this.active()) : null,
  );
  /** The groups whose list could not be read, as a sentence part. */
  protected readonly failedGroups = computed(() => {
    const failed = this.search.failed();
    return failed.length === 0 ? null : failed.map((group) => T.groups[group]).join(', ');
  });

  constructor() {
    effect(() => {
      if (this.full() && this.open()) {
        untracked(() => {
          const active = this.document.activeElement;
          this.opener = active instanceof HTMLElement ? active : null;
          void this.search.refresh();
          afterNextRender(() => this.field()?.nativeElement.focus(), { injector: this.injector });
        });
      }
    });
  }

  /** Ctrl K: the focus into the bar (or the full-screen view on compact — the shell opens it). */
  focus(): void {
    this.field()?.nativeElement.focus();
  }

  protected optionId(index: number): string {
    return `${this.listId}-option-${String(index)}`;
  }

  protected opened(): void {
    if (!this.full() && !this.expanded()) {
      this.expanded.set(true);
      void this.search.refresh();
    }
  }

  protected type(value: string): void {
    this.search.query.set(value);
    this.active.set(0);
    this.opened();
  }

  protected clear(): void {
    this.search.query.set('');
    this.active.set(0);
    this.field()?.nativeElement.focus();
  }

  protected key(event: KeyboardEvent): void {
    const count = this.flat().length;
    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowUp': {
        event.preventDefault();
        this.opened();
        if (count > 0) {
          const step = event.key === 'ArrowDown' ? 1 : -1;
          this.active.set((this.active() + step + count) % count);
          this.document.getElementById(this.optionId(this.active()))?.scrollIntoView({
            block: 'nearest',
          });
        }
        break;
      }
      case 'Enter': {
        const item = this.flat()[this.active()];
        if (item) {
          event.preventDefault();
          void this.router.navigate(item.entry.link, { queryParams: item.entry.query });
          this.picked();
        }
        break;
      }
      case 'Escape':
        event.preventDefault();
        if (this.full()) {
          this.close();
        } else if (this.expanded()) {
          this.expanded.set(false);
        } else {
          this.reset();
          this.field()?.nativeElement.blur();
        }
        break;
    }
  }

  /** A result was opened: the search is done, the field is empty again. */
  protected picked(): void {
    this.reset();
    if (this.full()) {
      this.opener = null;
      this.open.set(false);
    } else {
      this.field()?.nativeElement.blur();
    }
  }

  /** Closes the full-screen view and gives the focus back to the button that opened it. */
  protected close(): void {
    const opener = this.opener;
    this.opener = null;
    this.reset();
    this.open.set(false);
    opener?.focus();
  }

  private reset(): void {
    this.search.query.set('');
    this.active.set(0);
    this.expanded.set(false);
  }

  /** The focus left the bar: its results close (a press on a result does not move the focus). */
  protected leave(event: FocusEvent): void {
    if (this.full()) {
      return;
    }
    const next = event.relatedTarget;
    if (!(next instanceof Node) || !this.host.nativeElement.contains(next)) {
      this.expanded.set(false);
    }
  }

  /** Tab stays inside the full-screen dialog. */
  protected trap(keyboard: KeyboardEvent): void {
    if (!this.full() || keyboard.key !== 'Tab') {
      return;
    }
    const items = Array.from(this.host.nativeElement.querySelectorAll<HTMLElement>(FOCUSABLE));
    const first = items[0];
    const last = items.at(-1);
    const current = this.document.activeElement;
    if (keyboard.shiftKey && current === first) {
      keyboard.preventDefault();
      last?.focus();
    } else if (!keyboard.shiftKey && current === last) {
      keyboard.preventDefault();
      first?.focus();
    }
  }
}
