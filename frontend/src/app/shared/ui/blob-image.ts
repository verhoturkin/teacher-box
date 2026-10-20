import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { Observable, Subscription } from 'rxjs';

/**
 * A picture the API serves to signed-in users only (a board preview, a textbook cover): fetched with the
 * HTTP client as a blob and shown through an object URL. While it is absent, loading or failed (404: no
 * preview yet), the placeholder icon is shown instead. `loader` must be a stable function (a class
 * property), the picture is fetched again when `ref` or `version` changes.
 *
 * ```html
 * <tb-blob-image [loader]="loadPreview" [ref]="board.id" [version]="board.previewUpdatedAt" icon="tb-i-co_present" />
 * ```
 */
@Component({
  selector: 'tb-blob-image',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'tb-blob-image' },
  template: `
    @if (url(); as src) {
      <img [src]="src" alt="" draggable="false" />
    } @else {
      <i class="tb-i" [class]="icon()" aria-hidden="true"></i>
    }
  `,
  styles: `
    :host {
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
    }

    img {
      display: block;
      inline-size: 100%;
      block-size: 100%;
      object-fit: contain;
    }

    .tb-i {
      font-size: 3rem;
      color: var(--p-md-on-surface-variant);
    }
  `,
})
export class BlobImage {
  readonly loader = input.required<(ref: string) => Observable<Blob>>();
  /** What the picture belongs to (an id); `null` — nothing to fetch. */
  readonly ref = input<string | null>(null);
  /** Changes when the picture does (the time it was made); fetched again then. */
  readonly version = input<string | null>(null);
  /** The placeholder: a `tb-i-<name>` icon class. */
  readonly icon = input.required<string>();

  protected readonly url = signal<string | null>(null);
  private subscription: Subscription | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.release();
    });
    effect(() => {
      const loader = this.loader();
      const ref = this.ref();
      this.version();
      untracked(() => {
        this.release();
        if (ref === null) {
          return;
        }
        this.subscription = loader(ref).subscribe({
          next: (blob) => {
            this.url.set(URL.createObjectURL(blob));
          },
          error: () => {
            this.url.set(null);
          },
        });
      });
    });
  }

  private release(): void {
    this.subscription?.unsubscribe();
    this.subscription = null;
    const url = this.url();
    if (url !== null) {
      URL.revokeObjectURL(url);
      this.url.set(null);
    }
  }
}
