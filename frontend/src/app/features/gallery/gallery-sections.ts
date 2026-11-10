import { Type } from '@angular/core';
import { ElevationSample } from './tokens/elevation';
import { ShapeSample } from './tokens/shape';
import { SpacingSample } from './tokens/spacing';
import { AccentRolesSample } from './colour/accent-roles';
import { SurfaceRolesSample } from './colour/surface-roles';
import { StatusRolesSample } from './colour/status-roles';
import { LabelColoursSample } from './colour/label-colours';
import { TypeScaleSample } from './typography/type-scale';
import { EmphasizedSample } from './typography/emphasized';
import { IconMarkupSample } from './icons/markup';
import { IconSizesSample } from './icons/sizes';

/** One sample: its file under `features/gallery/`, a short title and the component that renders it. */
export interface GallerySample {
  readonly path: string;
  readonly title: string;
  readonly component: Type<unknown>;
}

/** A section of the gallery: one part of `docs/design-system.md`, its anchor, icon and samples. */
export interface GallerySection {
  readonly id: string;
  readonly part: string;
  readonly title: string;
  readonly icon: string;
  readonly samples: readonly GallerySample[];
}

/** The sections in the order of `docs/design-system.md`. */
export const GALLERY_SECTIONS: readonly GallerySection[] = [
  {
    id: 'tokens',
    part: '§1',
    title: 'Tokens',
    icon: 'tb-i-tune',
    samples: [
      { path: 'tokens/shape.ts', title: 'Shape', component: ShapeSample },
      { path: 'tokens/spacing.ts', title: 'Spacing', component: SpacingSample },
      { path: 'tokens/elevation.ts', title: 'Elevation', component: ElevationSample },
    ],
  },
  {
    id: 'colour',
    part: '§2',
    title: 'Colour',
    icon: 'tb-i-palette',
    samples: [
      { path: 'colour/accent-roles.ts', title: 'Accent roles', component: AccentRolesSample },
      { path: 'colour/surface-roles.ts', title: 'Surface roles', component: SurfaceRolesSample },
      {
        path: 'colour/status-roles.ts',
        title: 'Status = severity = role',
        component: StatusRolesSample,
      },
      {
        path: 'colour/label-colours.ts',
        title: 'Colours of students and groups',
        component: LabelColoursSample,
      },
    ],
  },
  {
    id: 'typography',
    part: '§3',
    title: 'Typography',
    icon: 'tb-i-short_text',
    samples: [
      { path: 'typography/type-scale.ts', title: 'Type scale', component: TypeScaleSample },
      { path: 'typography/emphasized.ts', title: 'Emphasized roles', component: EmphasizedSample },
    ],
  },
  {
    id: 'icons',
    part: '§4',
    title: 'Icons',
    icon: 'tb-i-diamond',
    samples: [
      { path: 'icons/markup.ts', title: 'Markup', component: IconMarkupSample },
      { path: 'icons/sizes.ts', title: 'Sizes and fill', component: IconSizesSample },
    ],
  },
];
