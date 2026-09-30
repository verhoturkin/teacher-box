import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  TemplateRef,
  afterEveryRender,
  computed,
  inject,
  contentChild,
  input,
  model,
} from '@angular/core';
import { Badge } from 'primeng/badge';

let nextId = 0;

/**
 * A card that folds (ADR-0019): the title is a button with a chevron and a line of details under
 * it. The content is an `<ng-template>`: a folded card does not render it (nor load its data) until
 * it is opened. A card that does not fold (`collapsible` false) is always open. Cards inside the
 * content lose their own frame and become sections of this one.
 *
 * ```html
 * <tb-fold-card title="Мессенджеры" summary="Боты и ваши мессенджеры" [(open)]="open">
 *   <ng-template><tb-bots-panel /></ng-template>
 * </tb-fold-card>
 * ```
 */
@Component({
  selector: 'tb-fold-card',
  imports: [NgTemplateOutlet, Badge],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'tb-fold-card',
    '[class.tb-fold-card--collapsible]': 'collapsible()',
    '[class.tb-fold-card--open]': 'expanded()',
    '[class.tb-fold-card--single]': 'single()',
  },
  template: `
    <h2 class="tb-fold-card__heading">
      @if (collapsible()) {
        <button
          type="button"
          class="tb-fold-card__toggle"
          [attr.aria-expanded]="expanded()"
          [attr.aria-controls]="bodyId"
          (click)="toggle()"
        >
          <ng-container [ngTemplateOutlet]="heading" />
          <span class="tb-fold-card__chevron" aria-hidden="true">
            <i class="pi pi-chevron-down"></i>
          </span>
        </button>
      } @else {
        <ng-container [ngTemplateOutlet]="heading" />
      }
    </h2>
    <ng-template #heading>
      <span class="tb-fold-card__text">
        <span class="tb-fold-card__title">
          {{ title() }}
          @if (badge() > 0) {
            <p-badge [value]="badge()" />
          }
        </span>
        @if (summary(); as summary) {
          <span class="tb-fold-card__summary">{{ summary }}</span>
        }
      </span>
    </ng-template>
    <div class="tb-fold-card__body" role="region" [id]="bodyId" [attr.aria-label]="title()">
      @if (expanded()) {
        <ng-container [ngTemplateOutlet]="content()" />
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
      border-radius: var(--tb-shape-lg-plus);
      background: var(--p-content-background);
      color: var(--p-md-on-surface);
    }

    .tb-fold-card__heading {
      margin: 0;
      padding: var(--tb-space-5) var(--tb-space-6) var(--tb-space-3);
      font: var(--tb-type-title-l-emphasized);
    }

    :host(.tb-fold-card--collapsible) .tb-fold-card__heading {
      padding: var(--tb-space-3) var(--tb-space-4) var(--tb-space-3) var(--tb-space-6);
    }

    .tb-fold-card__toggle {
      display: flex;
      align-items: center;
      gap: var(--tb-space-3);
      width: 100%;
      min-height: 3.5rem;
      margin: 0;
      padding: 0;
      border: 0;
      border-radius: var(--tb-shape-md);
      background: none;
      color: inherit;
      font: inherit;
      text-align: left;
      cursor: pointer;

      &:focus-visible {
        outline: 3px solid var(--p-md-secondary);
        outline-offset: 2px;
      }

      &:hover .tb-fold-card__chevron {
        background: color-mix(in srgb, var(--p-md-on-surface) 8%, transparent);
      }
    }

    .tb-fold-card__text {
      display: flex;
      flex: 1;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }

    .tb-fold-card__title {
      display: inline-flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--tb-space-2);
    }

    .tb-fold-card__summary {
      color: var(--p-md-on-surface-variant);
      font: var(--tb-type-body-m);
    }

    .tb-fold-card__chevron {
      display: flex;
      flex: none;
      align-items: center;
      justify-content: center;
      width: 2.5rem;
      height: 2.5rem;
      border-radius: var(--tb-shape-full);
      color: var(--p-md-on-surface-variant);
      transition: background var(--tb-spring-fast-effects);

      i {
        transition: transform var(--tb-spring-default-spatial);
      }
    }

    :host(.tb-fold-card--open) .tb-fold-card__chevron i {
      transform: rotate(180deg);
    }

    .tb-fold-card__body:empty {
      display: none;
    }

    .tb-fold-card__body {
      padding: 0 var(--tb-space-6) var(--tb-space-5);
    }

    /*
     * Only the start of the animation is filled (backwards): an element with a transform left after
     * its animation would hold the dialogs of the section like a frame instead of the screen.
     */
    :host(.tb-fold-card--collapsible) .tb-fold-card__body {
      animation: tb-fold-in var(--tb-spring-default-spatial) backwards;
    }

    @keyframes tb-fold-in {
      from {
        opacity: 0;
        transform: translateY(calc(-1 * var(--tb-space-2)));
      }
    }

    @media (max-width: 768px) {
      .tb-fold-card__heading,
      :host(.tb-fold-card--collapsible) .tb-fold-card__heading {
        padding-inline: var(--tb-space-4) var(--tb-space-2);
      }

      .tb-fold-card__body {
        padding-inline: var(--tb-space-4);
      }
    }

    /* Cards of the content are sections of this one: no frame of their own, a line between them */
    :host ::ng-deep .tb-fold-card__body {
      .p-card {
        border-radius: 0;
        background: transparent;
        box-shadow: none;

        > .p-card-body {
          padding: 0;
        }
      }

      .p-card-title {
        font: var(--tb-type-title-m);
      }

      .tb-stack > * + * {
        padding-top: var(--tb-space-5);
        border-top: 1px solid var(--p-md-outline-variant);
      }
    }

    /* One card in the content: its title repeats the title of this one */
    :host(.tb-fold-card--single) ::ng-deep .tb-fold-card__body .p-card-title {
      display: none;
    }
  `,
})
export class FoldCard {
  readonly title = input.required<string>();
  /** A line of details under the title, e.g. what the section is for. */
  readonly summary = input<string | null>(null);
  /** A counter next to the title (e.g. unread notifications); none when 0. */
  readonly badge = input(0);
  /** A card that does not fold is always open. */
  readonly collapsible = input(true);
  /** The content is one card whose title repeats the title of this one: it is hidden. */
  readonly single = input(false);
  /** Whether a folding card is open. */
  readonly open = model(false);

  protected readonly content = contentChild.required(TemplateRef);
  protected readonly expanded = computed(() => !this.collapsible() || this.open());
  protected readonly bodyId = `tb-fold-card-${String(nextId++)}`;

  constructor() {
    // the cards of the content are sections of this one: their titles are one level lower (ADR-0024)
    const host = inject<ElementRef<HTMLElement>>(ElementRef);
    afterEveryRender(() => {
      for (const title of host.nativeElement.querySelectorAll(
        '.tb-fold-card__body .p-card-title[aria-level="2"]',
      )) {
        title.setAttribute('aria-level', '3');
      }
    });
  }

  protected toggle(): void {
    this.open.update((open) => !open);
  }
}
