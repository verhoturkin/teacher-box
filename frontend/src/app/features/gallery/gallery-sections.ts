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
import { MarkdownSample } from './typography/markdown';
import { PageHeaderSample } from './frame/page-header';
import { PanesSample } from './frame/panes';
import { NavigationSample } from './frame/navigation';
import { ButtonVariantsSample } from './buttons/variants';
import { ButtonSizesSample } from './buttons/sizes';
import { FabSample } from './buttons/fab';
import { SplitButtonSample } from './buttons/split';
import { ButtonGroupsSample } from './buttons/groups';
import { SelectButtonSample } from './buttons/select-button';
import { TextFieldsSample } from './fields/text';
import { SelectFieldsSample } from './fields/select';
import { StepperSample } from './fields/stepper';
import { SearchSample } from './fields/search';
import { ChipsSample } from './fields/chips';
import { FieldErrorsSample } from './fields/errors';
import { SegmentedListSample } from './lists/segmented-list';
import { TableSample } from './lists/table';
import { CardsSample } from './lists/cards';
import { SwipeSample } from './lists/swipe';
import { AlertDialogSample } from './dialogs/alert';
import { FormDialogSample } from './dialogs/form';
import { SheetDialogSample } from './dialogs/sheet';
import { WizardDialogSample } from './dialogs/wizard';
import { SideSheetSample } from './dialogs/side-sheet';
import { MenuSample } from './dialogs/menu';
import { LoadStateSample } from './states/load-state';
import { EmptyStateSample } from './states/empty-state';
import { FeedbackSample } from './states/feedback';
import { ProgressSample } from './states/progress';
import { SpatialSpringsSample } from './motion/spatial';
import { EffectsSpringsSample } from './motion/effects';
import { OverlayMotionSample } from './motion/overlays';
import { PaneMotionSample } from './motion/panes';
import { SheetMotionSample } from './motion/sheets';

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
      { path: 'typography/markdown.ts', title: 'Markdown', component: MarkdownSample },
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
  {
    id: 'frame',
    part: '§7',
    title: 'Panes and page anatomy',
    icon: 'tb-i-dashboard',
    samples: [
      { path: 'frame/page-header.ts', title: 'Page header', component: PageHeaderSample },
      {
        path: 'frame/navigation.ts',
        title: 'Pane and section navigation',
        component: NavigationSample,
      },
      { path: 'frame/panes.ts', title: 'Panes', component: PanesSample },
    ],
  },
  {
    id: 'buttons',
    part: '§8',
    title: 'Buttons',
    icon: 'tb-i-radio_button_checked',
    samples: [
      { path: 'buttons/variants.ts', title: 'Variants', component: ButtonVariantsSample },
      { path: 'buttons/sizes.ts', title: 'Sizes', component: ButtonSizesSample },
      { path: 'buttons/fab.ts', title: 'FAB menu', component: FabSample },
      { path: 'buttons/split.ts', title: 'Split button', component: SplitButtonSample },
      {
        path: 'buttons/groups.ts',
        title: 'Button groups and segments',
        component: ButtonGroupsSample,
      },
      { path: 'buttons/select-button.ts', title: 'Select button', component: SelectButtonSample },
    ],
  },
  {
    id: 'fields',
    part: '§9',
    title: 'Fields',
    icon: 'tb-i-short_text',
    samples: [
      { path: 'fields/text.ts', title: 'Text fields', component: TextFieldsSample },
      { path: 'fields/select.ts', title: 'Selects and dates', component: SelectFieldsSample },
      { path: 'fields/stepper.ts', title: 'Numbers and passwords', component: StepperSample },
      { path: 'fields/search.ts', title: 'Search field', component: SearchSample },
      { path: 'fields/chips.ts', title: 'Chips', component: ChipsSample },
      {
        path: 'fields/errors.ts',
        title: 'Required fields and errors',
        component: FieldErrorsSample,
      },
    ],
  },
  {
    id: 'lists',
    part: '§10',
    title: 'Lists, tables, chips, cards',
    icon: 'tb-i-view_list',
    samples: [
      { path: 'lists/segmented-list.ts', title: 'Segmented list', component: SegmentedListSample },
      { path: 'lists/table.ts', title: 'Table', component: TableSample },
      { path: 'lists/cards.ts', title: 'Cards', component: CardsSample },
      { path: 'lists/swipe.ts', title: 'Swipe', component: SwipeSample },
    ],
  },
  {
    id: 'dialogs',
    part: '§11',
    title: 'Dialogs, sheets, menus',
    icon: 'tb-i-open_in_full',
    samples: [
      { path: 'dialogs/alert.ts', title: 'Alert', component: AlertDialogSample },
      { path: 'dialogs/form.ts', title: 'Form', component: FormDialogSample },
      { path: 'dialogs/sheet.ts', title: 'Sheet', component: SheetDialogSample },
      {
        path: 'dialogs/wizard.ts',
        title: 'Wizard with its own footer',
        component: WizardDialogSample,
      },
      { path: 'dialogs/side-sheet.ts', title: 'Side sheet', component: SideSheetSample },
      { path: 'dialogs/menu.ts', title: 'Menu', component: MenuSample },
    ],
  },
  {
    id: 'states',
    part: '§12',
    title: 'States and feedback',
    icon: 'tb-i-hourglass_top',
    samples: [
      { path: 'states/load-state.ts', title: 'Load states', component: LoadStateSample },
      { path: 'states/empty-state.ts', title: 'Empty state', component: EmptyStateSample },
      {
        path: 'states/feedback.ts',
        title: 'Snackbar and confirmations',
        component: FeedbackSample,
      },
      { path: 'states/progress.ts', title: 'Progress and busy actions', component: ProgressSample },
    ],
  },
  {
    id: 'motion',
    part: '§1, §11',
    title: 'Motion',
    icon: 'tb-i-bolt',
    samples: [
      { path: 'motion/spatial.ts', title: 'Spatial springs', component: SpatialSpringsSample },
      { path: 'motion/effects.ts', title: 'Effects springs', component: EffectsSpringsSample },
      {
        path: 'motion/overlays.ts',
        title: 'Dialogs, menus, snackbar',
        component: OverlayMotionSample,
      },
      { path: 'motion/sheets.ts', title: 'Side and bottom sheets', component: SheetMotionSample },
      { path: 'motion/panes.ts', title: 'Panes of a page', component: PaneMotionSample },
    ],
  },
];
