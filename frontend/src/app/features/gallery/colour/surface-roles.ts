import { ChangeDetectionStrategy, Component } from '@angular/core';
import { BothThemes } from '../both-themes';

const SURFACES = [
  '--p-md-surface',
  '--p-md-surface-container-lowest',
  '--p-md-surface-container-low',
  '--p-md-surface-container',
  '--p-md-surface-container-high',
  '--p-md-surface-container-highest',
] as const;

/** Aliases set on `:root` per theme: they follow the page's theme switch, not the panels. */
const ALIASES = ['--tb-card', '--tb-list-item'] as const;

const LINES = ['--p-md-outline', '--p-md-outline-variant'] as const;

/** §2 Surfaces: the tones of the frame, panes, cards and list tiles; outlines; in both themes. */
@Component({
  selector: 'tb-gallery-surface-roles',
  imports: [BothThemes],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-template #sample>
      <ul class="tb-gallery-grid">
        @for (token of surfaces; track token) {
          <li class="tile" [style.background]="'var(' + token + ')'">
            <code>{{ token }}</code>
          </li>
        }
        @for (token of lines; track token) {
          <li class="tile" [style.border-color]="'var(' + token + ')'">
            <code>border: 1px solid var({{ token }})</code>
          </li>
        }
      </ul>
    </ng-template>
    <tb-gallery-both-themes [sample]="sample" />
    <ul class="tb-gallery-grid aliases">
      @for (token of aliases; track token) {
        <li class="tile" [style.background]="'var(' + token + ')'">
          <code>{{ token }}</code> (page theme)
        </li>
      }
    </ul>
  `,
  styles: `
    .aliases {
      margin-top: var(--tb-space-4);
      padding: var(--tb-space-4);
      border-radius: var(--tb-shape-lg);
      background: var(--p-md-surface);
    }

    .tile {
      padding: var(--tb-space-3);
      border: 1px solid transparent;
      border-radius: var(--tb-shape-md);
      color: var(--p-md-on-surface);
      font: var(--tb-type-body-s);
      overflow-wrap: anywhere;
    }
  `,
})
export class SurfaceRolesSample {
  protected readonly surfaces = SURFACES;
  protected readonly lines = LINES;
  protected readonly aliases = ALIASES;
}
