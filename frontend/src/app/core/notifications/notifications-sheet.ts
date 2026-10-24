import { NgComponentOutlet, NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DOCUMENT,
  ElementRef,
  Type,
  afterRenderEffect,
  effect,
  inject,
  input,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { ButtonDirective, ButtonIcon } from 'primeng/button';
import { Drawer } from 'primeng/drawer';
import { CORE_T } from '@core/i18n/texts';
import { ModalDrawer } from '@shared/ui/modal-drawer';
import { NOTIFICATIONS_SHEET_CONTENT, NotificationsSheetState } from './notifications-sheet-state';

const T = CORE_T.bell;

/** The path of an address without its query and fragment. */
function pathOf(url: string): string {
  return url.split(/[?#]/)[0] ?? '';
}

/**
 * The notifications side sheet of the bell (redesign spec §10.3): the inbox and the sent messages. Docked
 * (extra-large) it is the non-modal standard side sheet — the third pane of the frame, beside the page, which
 * stays usable; it keeps its place across the pages. Otherwise it is the modal `tb-side-sheet` over the page,
 * as the help (the whole screen on compact); it closes when a notification leads to another page.
 */
@Component({
  selector: 'tb-notifications-sheet',
  imports: [ButtonDirective, ButtonIcon, Drawer, ModalDrawer, NgComponentOutlet, NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (docked()) {
      @if (state.open()) {
        <aside
          #pane
          id="tb-notifications-sheet"
          class="tb-notifications-pane"
          tabindex="-1"
          aria-labelledby="tb-notifications-sheet-title"
          (keydown.escape)="closeDocked()"
        >
          <div class="tb-notifications-pane__head">
            <h2 id="tb-notifications-sheet-title" class="tb-notifications-pane__title">
              {{ t.notifications }}
            </h2>
            <ng-container *ngTemplateOutlet="state.headerAction()" />
            <button
              pButton
              type="button"
              [text]="true"
              [rounded]="true"
              severity="secondary"
              [attr.aria-label]="close"
              (click)="closeDocked()"
            >
              <i pButtonIcon class="tb-i tb-i-close" aria-hidden="true"></i>
            </button>
          </div>
          <ng-container *ngComponentOutlet="content()" />
        </aside>
      }
    } @else {
      <p-drawer
        tbModalDrawer
        [visible]="state.open()"
        (visibleChange)="$event ? state.show() : state.close()"
        position="right"
        appendTo="body"
        [blockScroll]="true"
        [maskStyle]="{
          '--px-mask-background': 'var(--tb-notifications-scrim, var(--p-mask-background))',
        }"
        [ariaCloseLabel]="close"
        styleClass="tb-side-sheet tb-side-sheet--narrow tb-notifications-modal"
      >
        <ng-template #header>
          <span class="p-drawer-title tb-notifications-modal__title">{{ t.notifications }}</span>
          <ng-container *ngTemplateOutlet="state.headerAction()" />
        </ng-template>
        <ng-container *ngComponentOutlet="content()" />
      </p-drawer>
    }
  `,
  styles: `
    /* M3 standard side sheet ≤ 400 dp; ours (the sketches): a pane of the frame on surface like the others, 28 dp corners,
       24 dp from the trailing edge and the bottom (as tb-pane kind="sheet") */
    :host {
      flex: none;
    }

    .tb-notifications-pane {
      position: sticky;
      top: var(--tb-header-height);
      inline-size: 25rem;
      box-sizing: border-box;
      max-width: 25rem;
      height: calc(100dvh - var(--tb-header-height) - var(--tb-space-6));
      /* the rail runs up beside the top strip and the body is pulled up under it (shell.scss): the pane starts below the strip */
      margin: var(--tb-header-height) var(--tb-space-6) var(--tb-space-6) 0;
      padding: 0 var(--tb-space-6) var(--tb-space-6);
      overflow-y: auto;
      overscroll-behavior: contain;
      border-radius: var(--tb-shape-xl);
      background: var(--p-md-surface);
      --tb-field-surface: var(--p-md-surface);
      color: var(--p-md-on-surface);
      outline: none;
      animation:
        tb-motion-slide-in var(--tb-spring-default-spatial),
        tb-motion-fade-in var(--tb-spring-default-effects);
      --tb-motion-x: var(--tb-space-6);
    }

    .tb-notifications-pane__head {
      display: flex;
      align-items: center;
      gap: var(--tb-space-2);
      margin-inline-end: calc(-1 * var(--tb-space-3));
      padding-block: var(--tb-space-4);
    }

    .tb-notifications-pane__title {
      flex: 1;
      margin: 0;
      font: var(--tb-type-headline-s);
    }
  `,
})
export class NotificationsSheet {
  protected readonly t = T;
  protected readonly close = CORE_T.close;
  protected readonly state = inject(NotificationsSheetState);
  private readonly load = inject(NOTIFICATIONS_SHEET_CONTENT, { optional: true });
  private readonly document = inject(DOCUMENT);

  /** The third pane of the frame (extra-large) instead of the modal sheet. */
  readonly docked = input(false);

  protected readonly content = signal<Type<unknown> | null>(null);
  private readonly pane = viewChild<ElementRef<HTMLElement>>('pane');
  /** What had the focus when the docked sheet opened: it gets it back when the sheet closes. */
  private opener: HTMLElement | null = null;

  constructor() {
    // the content of the feature is loaded when the sheet first opens
    effect(() => {
      if (this.state.open() && untracked(this.content) === null && this.load !== null) {
        void this.load().then((type) => {
          this.content.set(type);
        });
      }
    });
    // the docked sheet takes the focus when it opens, as a sheet that was asked for
    afterRenderEffect(() => {
      const pane = this.pane()?.nativeElement;
      if (pane !== undefined && untracked(this.docked)) {
        const active = this.document.activeElement;
        this.opener = active instanceof HTMLElement && !pane.contains(active) ? active : null;
        pane.focus();
      }
    });
    // a notification that leads to another page closes the modal sheet over it
    const router = inject(Router);
    let path = pathOf(router.url);
    router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => {
        const next = pathOf(router.url);
        if (next !== path && !this.docked()) {
          this.state.close();
        }
        path = next;
      });
  }

  protected closeDocked(): void {
    const opener = this.opener;
    this.opener = null;
    this.state.close();
    if (opener?.isConnected === true) {
      opener.focus();
    }
  }
}
