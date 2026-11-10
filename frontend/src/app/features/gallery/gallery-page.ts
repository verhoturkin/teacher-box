import { NgComponentOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ViewEncapsulation,
  computed,
  inject,
} from '@angular/core';
import { ThemeMode } from '@core/theme/theme-mode';
import { PageHeader } from '@shared/ui/page-header';
import { SectionNav, SectionNavItem } from '@shared/ui/section-nav';
import { Segment, SegmentGroup } from '@shared/ui/segment-group';
import { GALLERY_SECTIONS } from './gallery-sections';

type Theme = 'light' | 'dark';

/** Where the samples live, as an agent searches for them. */
export const SAMPLE_ROOT = 'frontend/src/app/features/gallery/';

/**
 * The design gallery (ADR-0059): every sample of `GALLERY_SECTIONS` in its section, with the file it lives in.
 * Development builds only; captions are literal English (a tool for developers, not the product).
 * The `tb-gallery-*` classes are shared by the samples, so the page has no view encapsulation.
 */
@Component({
  selector: 'tb-gallery-page',
  imports: [NgComponentOutlet, PageHeader, SectionNav, SegmentGroup],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: { class: 'tb-gallery' },
  template: `
    <tb-page-header title="Design gallery">
      <span meta>Real components and tokens of docs/design-system.md; one sample = one file.</span>
      <tb-segment-group
        label="Theme"
        [segments]="themes"
        [value]="theme()"
        (valueChange)="choose($event)"
      />
    </tb-page-header>
    <div class="tb-gallery__body">
      <tb-section-nav class="tb-gallery__nav" [items]="nav" label="Gallery sections" />
      <main class="tb-gallery__main">
        @for (section of sections; track section.id) {
          <section class="tb-gallery__section" [id]="section.id">
            <h2 class="tb-gallery__section-title">{{ section.part }} {{ section.title }}</h2>
            @for (sample of section.samples; track sample.path) {
              <article class="tb-gallery-sample">
                <h3 class="tb-gallery-sample__title">{{ sample.title }}</h3>
                <code class="tb-gallery-sample__path">{{ root }}{{ sample.path }}</code>
                <div class="tb-gallery-sample__body">
                  <ng-container *ngComponentOutlet="sample.component" />
                </div>
              </article>
            }
          </section>
        }
      </main>
    </div>
  `,
  styles: `
    .tb-gallery {
      display: block;
      max-width: var(--tb-content-max);
      margin: 0 auto;
      padding: var(--tb-space-6) var(--tb-space-4);
    }

    .tb-gallery__body {
      display: grid;
      gap: var(--tb-space-6);

      @media (width >= 52.5em) {
        grid-template-columns: 13rem minmax(0, 1fr);
        align-items: start;
      }
    }

    .tb-gallery__nav {
      @media (width >= 52.5em) {
        position: sticky;
        top: var(--tb-space-4);
      }
    }

    .tb-gallery__main,
    .tb-gallery__section {
      display: flex;
      flex-direction: column;
      gap: var(--tb-space-6);
      min-width: 0;
    }

    .tb-gallery__section {
      gap: var(--tb-space-4);
      scroll-margin-top: var(--tb-space-4);
    }

    .tb-gallery__section-title {
      margin: 0;
      font: var(--tb-type-title-l-emphasized);
    }

    .tb-gallery-sample {
      display: flex;
      flex-direction: column;
      gap: var(--tb-space-2);
      padding: var(--tb-space-4);
      border-radius: var(--tb-shape-lg-plus);
      background: var(--tb-card);
    }

    .tb-gallery-sample__title {
      margin: 0;
      font: var(--tb-type-title-m);
      letter-spacing: var(--tb-tracking-title-m);
    }

    .tb-gallery-sample__body {
      padding-top: var(--tb-space-2);
    }

    .tb-gallery-sample__path,
    .tb-gallery-name {
      overflow-wrap: anywhere;
      color: var(--p-md-on-surface-variant);
      font: var(--tb-type-body-s);
      font-family: var(--tb-font-mono);
    }

    .tb-gallery-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(11rem, 1fr));
      gap: var(--tb-space-4);
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .tb-gallery-row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--tb-space-4);
    }

    .tb-gallery-cell {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: var(--tb-space-2);
      min-width: 0;
    }

    .tb-gallery-box {
      inline-size: 4rem;
      block-size: 4rem;
      background: var(--p-md-primary-container);
    }
  `,
})
export class GalleryPage {
  private readonly mode = inject(ThemeMode);
  protected readonly root = SAMPLE_ROOT;
  protected readonly sections = GALLERY_SECTIONS;
  protected readonly nav: readonly SectionNavItem[] = GALLERY_SECTIONS.map((section) => ({
    id: section.id,
    icon: section.icon,
    label: `${section.part} ${section.title}`,
  }));
  protected readonly themes: readonly Segment<Theme>[] = [
    { value: 'light', label: 'Light', icon: 'tb-i tb-i-light_mode' },
    { value: 'dark', label: 'Dark', icon: 'tb-i tb-i-dark_mode' },
  ];
  protected readonly theme = computed<Theme>(() => (this.mode.dark() ? 'dark' : 'light'));

  /** The real theme switch of the portal: the choice is stored on the device, as in «Оформление». */
  protected choose(theme: Theme): void {
    this.mode.choose(theme);
  }
}
