import { ChangeDetectionStrategy, Component, computed, input, linkedSignal } from '@angular/core';
import { InitialsPipe } from './initials';

/**
 * A person's avatar (ADR-0020): their photo cut to a circle, or the initials of the name when there is
 * no photo or it does not load. Decorative: the name is always next to it.
 */
@Component({
  selector: 'tb-avatar',
  imports: [InitialsPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'tb-avatar',
    'aria-hidden': 'true',
    '[class.tb-avatar--photo]': 'shown() !== null',
    '[style.width]': 'size()',
    '[style.height]': 'size()',
    '[style.font-size]': 'fontSize()',
  },
  template: `
    @if (shown(); as photo) {
      <img [src]="photo" alt="" (error)="failed.set(true)" />
    } @else {
      {{ name() | initials }}
    }
  `,
  styles: `
    :host {
      overflow: hidden;
    }

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
  `,
})
export class Avatar {
  readonly name = input.required<string>();
  /** Address of the photo; `null`: the initials. */
  readonly photo = input<string | null>(null);
  /** Diameter, e.g. `6rem`; by default the 40 px of a list row. */
  readonly size = input<string | null>(null);

  /** The photo did not load (removed meanwhile): the initials instead, until another photo comes. */
  protected readonly failed = linkedSignal({ source: this.photo, computation: () => false });
  protected readonly shown = computed(() => (this.failed() ? null : this.photo()));
  protected readonly fontSize = computed(() => {
    const size = this.size();
    return size === null ? null : `calc(${size} * 0.4)`;
  });
}
