import {
  SchemeContent,
  SchemeExpressive,
  SchemeFidelity,
  SchemeFruitSalad,
  SchemeMonochrome,
  SchemeNeutral,
  SchemeRainbow,
  SchemeTonalSpot,
  SchemeVibrant,
} from '@material/material-color-utilities';

export const SCHEME_TYPES = {
  fidelity: SchemeFidelity,
  'tonal-spot': SchemeTonalSpot,
  vibrant: SchemeVibrant,
  expressive: SchemeExpressive,
  neutral: SchemeNeutral,
  monochrome: SchemeMonochrome,
  content: SchemeContent,
  rainbow: SchemeRainbow,
  'fruit-salad': SchemeFruitSalad,
} as const;
export const SCHEMES = [
  'fidelity',
  'tonal-spot',
  'vibrant',
  'expressive',
  'neutral',
  'monochrome',
  'content',
  'rainbow',
  'fruit-salad',
] as const;
export type SchemeType = (typeof SCHEMES)[number];
export const CONTRAST_LEVELS = { reduced: -1, standard: 0, increased: 0.5, maximum: 1 } as const;
export type ContrastLevel = keyof typeof CONTRAST_LEVELS;
export const CONTRASTS = ['reduced', 'standard', 'increased', 'maximum'] as const;
export interface Appearance {
  readonly scheme: SchemeType;
  readonly contrast: ContrastLevel;
}
export const DEFAULT_APPEARANCE: Appearance = { scheme: 'fidelity', contrast: 'standard' };

/** Screen approximations inspired by Pantone's Color of the Year selections; not print specifications. */
export const BASE_COLORS = [
  { value: 'indigo', name: 'indigo', reference: 'Teacher Box' },
  { value: '#0f4c81', name: 'blue', reference: 'Classic Blue · 2020' },
  { value: '#6667ab', name: 'peri', reference: 'Very Peri · 2022' },
  { value: '#009b77', name: 'emerald', reference: 'Emerald · 2013' },
  { value: '#bb2649', name: 'magenta', reference: 'Viva Magenta · 2023' },
  { value: '#ffbe98', name: 'peach', reference: 'Peach Fuzz · 2024' },
  { value: '#a47864', name: 'mocha', reference: 'Mocha Mousse · 2025' },
  { value: '#f5df4d', name: 'yellow', reference: 'Illuminating · 2021' },
  { value: '#f0eee9', name: 'cloud', reference: 'Cloud Dancer · 2026' },
] as const;
