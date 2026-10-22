import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { EMPTY, Observable } from 'rxjs';
import { Button } from 'primeng/button';
import { Tooltip } from 'primeng/tooltip';
import { ButtonAttributes } from './button-attributes';
import { BlobImage } from './blob-image';

/**
 * A card of the Materials feed (redesign spec §10.1): the preview on top (or the icon of the kind when it has
 * none), the title with a line of details and «⋮» under it. The whole card opens the material: the title is a
 * link (or a button) stretched over the card, «⋮» stays above it. `tonal`: no picture, the preview area is a
 * tonal tile with the icon (an external board); `tag` — the service of an external board, on the tile.
 *
 * ```html
 * <tb-material-card [title]="b.title" [supporting]="details" [routerLink]="[b.id]" [loader]="preview" [ref]="b.id"
 *   icon="tb-i-co_present" [actionsLabel]="t.actions(b.title)" (menu)="openMenu(b, $event)" />
 * ```
 * *Our decision* (M3 publishes no feed card): corner 20 dp (cards, design-system §1); the preview fills the top
 * of the card to its edges and clips to its corners; the caption is tonal (`surface container low`).
 */
@Component({
  selector: 'tb-material-card',
  imports: [RouterLink, Button, Tooltip, ButtonAttributes, BlobImage],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'tb-material-card' },
  template: `
    <div class="tb-material-card__preview" [class.tb-material-card__preview--tonal]="tonal()">
      <tb-blob-image [loader]="loader()" [ref]="ref()" [version]="version()" [icon]="icon()" />
      @if (tag(); as label) {
        <span class="tb-material-card__tag">
          <i class="tb-i tb-i-open_in_new" aria-hidden="true"></i>{{ label }}
        </span>
      }
    </div>
    <div class="tb-material-card__caption">
      <div class="tb-material-card__text">
        @if (routerLink(); as link) {
          <a class="tb-material-card__title" [routerLink]="link">{{ title() }}</a>
        } @else if (href(); as url) {
          <a class="tb-material-card__title" [href]="url" target="_blank" rel="noopener">{{
            title()
          }}</a>
        } @else {
          <button
            type="button"
            class="tb-material-card__title"
            [attr.aria-label]="openLabel() ?? title()"
            (click)="open.emit()"
          >
            {{ title() }}
          </button>
        }
        <span class="tb-material-card__supporting">{{ supporting() }}</span>
      </div>
      @if (actionsLabel(); as actions) {
        <p-button
          class="tb-material-card__menu"
          icon="tb-i tb-i-more_vert"
          [text]="true"
          [rounded]="true"
          severity="secondary"
          [pTooltip]="actions"
          [ariaLabel]="actions"
          [loading]="busy()"
          [tbAttributes]="{
            'aria-haspopup': 'menu',
            'aria-expanded': menuOpen() ? 'true' : 'false',
          }"
          (onClick)="menu.emit($event)"
        />
      }
    </div>
  `,
  styles: `
    :host {
      position: relative;
      display: flex;
      flex-direction: column;
      min-width: 0;
      max-inline-size: 15rem;
      overflow: hidden;
      border-radius: var(--tb-shape-lg-plus);
      background: var(--p-md-surface-container-low);
      transition: background var(--tb-spring-fast-effects);
    }

    :host(:hover) {
      background: color-mix(
        in srgb,
        var(--p-md-on-surface) var(--tb-state-hover),
        var(--p-md-surface-container-low)
      );
    }

    /* the focus of the title link rings the whole card */
    :host(:has(.tb-material-card__title:focus-visible)) {
      outline: 3px solid var(--p-md-secondary);
      outline-offset: 2px;
    }

    .tb-material-card__preview {
      position: relative;
      aspect-ratio: 8 / 5;
      background: var(--p-md-surface-container-lowest);

      tb-blob-image {
        position: absolute;
        inset: 0;
      }
    }

    .tb-material-card__preview--tonal {
      background: var(--p-md-surface-container-high);
    }

    .tb-material-card__tag {
      position: absolute;
      inset-block-start: var(--tb-space-2);
      inset-inline-start: var(--tb-space-2);
      display: inline-flex;
      align-items: center;
      gap: var(--tb-space-1);
      padding: 0.125rem var(--tb-space-3) 0.125rem var(--tb-space-2);
      border-radius: var(--tb-shape-sm);
      background: var(--p-md-secondary-container);
      color: var(--p-md-on-secondary-container);
      font: var(--tb-type-label-m);

      .tb-i {
        font-size: 1rem;
      }
    }

    .tb-material-card__caption {
      display: flex;
      align-items: center;
      gap: var(--tb-space-1);
      padding: var(--tb-space-3) var(--tb-space-2) var(--tb-space-3) var(--tb-space-4);
      min-block-size: 4.25rem;
    }

    .tb-material-card__text {
      display: flex;
      flex: 1 1 auto;
      flex-direction: column;
      min-width: 0;
    }

    .tb-material-card__title {
      overflow: hidden;
      padding: 0;
      border: 0;
      background: none;
      color: var(--p-md-on-surface);
      font: var(--tb-type-title-m);
      text-align: start;
      text-decoration: none;
      text-overflow: ellipsis;
      white-space: nowrap;
      cursor: pointer;

      /* the whole card is the target */
      &::after {
        content: '';
        position: absolute;
        inset: 0;
      }

      &:focus-visible {
        outline: none;
      }
    }

    .tb-material-card__supporting {
      overflow: hidden;
      color: var(--p-md-on-surface-variant);
      font: var(--tb-type-body-s);
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .tb-material-card__menu {
      position: relative;
      flex: none;
    }
  `,
})
export class MaterialCard {
  readonly title = input.required<string>();
  readonly supporting = input('');
  /** The service of an external board («Холст», «Miro»); none — no tag. */
  readonly tag = input<string | null>(null);
  /** A tonal preview tile instead of a picture (an external board). */
  readonly tonal = input(false);
  /** Opens inside the portal. */
  readonly routerLink = input<string | readonly unknown[] | null>(null);
  /** Opens in a new tab. */
  readonly href = input<string | null>(null);
  /** The accessible name of the opening button (when neither link is given). */
  readonly openLabel = input<string | null>(null);
  readonly loader = input<(ref: string) => Observable<Blob>>(() => EMPTY);
  readonly ref = input<string | null>(null);
  readonly version = input<string | null>(null);
  /** The icon of the kind, shown while there is no picture: a `tb-i-<name>` class. */
  readonly icon = input.required<string>();
  /** The name of «⋮»; none — the card has no actions (a student's). */
  readonly actionsLabel = input<string | null>(null);
  readonly menuOpen = input(false);
  readonly busy = input(false);

  /** The card was chosen and it has neither link (a textbook file). */
  readonly open = output();
  /** «⋮» was pressed. */
  readonly menu = output<Event>();
}
