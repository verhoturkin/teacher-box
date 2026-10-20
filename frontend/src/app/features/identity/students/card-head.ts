import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { Button } from 'primeng/button';
import { Tag } from 'primeng/tag';
import { Tooltip } from 'primeng/tooltip';
import { ButtonAttributes } from '@shared/ui/button-attributes';

/** A tag of the header: a status, the messenger, the balance. */
export interface HeaderTag {
  readonly value: string;
  readonly severity: 'success' | 'info' | 'warn' | 'danger' | 'secondary' | 'contrast' | null;
  readonly icon?: string;
}

/**
 * The header of a student's or a group's card (redesign spec §8): the 72 px avatar (projected as
 * `[avatar]`), the name (left to the page header on one pane), the supporting line, the tags, the actions
 * (projected) and «⋮», which asks the page to open its menu.
 */
@Component({
  selector: 'tb-card-head',
  imports: [Button, ButtonAttributes, Tag, Tooltip],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="tb-card-head">
      <ng-content select="[avatar]" />
      <div class="tb-card-head__text">
        @if (!single()) {
          <h2 class="tb-card-head__name">{{ name() }}</h2>
        }
        <span class="tb-card-head__line">{{ line() }}</span>
        @if (tags().length > 0) {
          <div class="tb-card-head__tags">
            @for (tag of tags(); track tag.value) {
              <p-tag [value]="tag.value" [severity]="tag.severity" [icon]="tag.icon ?? ''" />
            }
          </div>
        }
      </div>
      <div class="tb-card-head__actions">
        <ng-content />
        @if (!single()) {
          <p-button
            class="tb-card-head__more"
            icon="tb-i tb-i-more_vert"
            [text]="true"
            [rounded]="true"
            severity="secondary"
            [pTooltip]="actionsLabel()"
            [ariaLabel]="actionsLabel()"
            [loading]="busy()"
            [tbAttributes]="{
              'aria-haspopup': 'menu',
              'aria-expanded': menuOpen() ? 'true' : 'false',
            }"
            (onClick)="more.emit($event)"
          />
        }
      </div>
    </header>
  `,
  styles: `
    :host {
      display: block;
      margin-block-end: var(--tb-space-4);
    }

    .tb-card-head {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--tb-space-4);
    }

    .tb-card-head__text {
      display: flex;
      flex: 1 1 12rem;
      flex-direction: column;
      gap: var(--tb-space-1);
      min-width: 0;
    }

    .tb-card-head__name {
      margin: 0;
      font: var(--tb-type-headline-s);
      overflow-wrap: anywhere;
    }

    .tb-card-head__line {
      color: var(--p-md-on-surface-variant);
      font: var(--tb-type-body-m);
    }

    .tb-card-head__tags {
      display: flex;
      flex-wrap: wrap;
      gap: var(--tb-space-2);
      margin-block-start: var(--tb-space-1);
    }

    .tb-card-head__actions {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--tb-space-2);
    }

    /* compact: the actions under the name, equal width across the card (spec §8) */
    @media (width < 37.5em) {
      .tb-card-head__actions {
        display: grid;
        flex-basis: 100%;
        grid-auto-columns: 1fr;
        grid-auto-flow: column;

        ::ng-deep .p-button {
          width: 100%;
        }
      }
    }
  `,
})
export class CardHead {
  readonly name = input.required<string>();
  /** «с сентября 2025», «3 участника · с сентября 2025». */
  readonly line = input.required<string>();
  readonly tags = input<readonly HeaderTag[]>([]);
  /** One pane (compact, medium): the page header carries the name and «⋮». */
  readonly single = input(false);
  readonly actionsLabel = input.required<string>();
  /** An action of «⋮» is running. */
  readonly busy = input(false);
  readonly menuOpen = input(false);
  /** «⋮»: the page opens its menu. */
  readonly more = output<Event>();
}
