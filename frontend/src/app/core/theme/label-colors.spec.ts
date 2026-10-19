import { Hct, argbFromHex } from '@material/material-color-utilities';
import { contrast, difference } from './color';
import { DEFAULT_SCHEME } from './teacher-box-preset';
import {
  LABEL_COLORS,
  LABEL_TOKENS,
  LabelColor,
  isLabelColor,
  labelKey,
  labelName,
  labelRoles,
} from './label-colors';

const THEMES = [
  ['light', false],
  ['dark', true],
] as const;

describe('label colors', () => {
  it.each(THEMES)('keeps the text on every label readable (%s)', (_theme, dark) => {
    for (const label of LABEL_COLORS) {
      const roles = labelRoles(label, dark);
      expect.soft(contrast(roles.onContainer, roles.container), label).toBeGreaterThanOrEqual(4.5);
      expect.soft(contrast(roles.onColor, roles.color), label).toBeGreaterThanOrEqual(4.5);
      for (const surface of [
        roles.surfaceContainerLowest,
        roles.surfaceContainerLow,
        roles.surfaceContainerHigh,
      ]) {
        expect.soft(contrast(roles.onSurface, surface), label).toBeGreaterThanOrEqual(4.5);
        expect.soft(contrast(roles.onSurfaceVariant, surface), label).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it.each(THEMES)('builds the rows from the same tones as the portal (%s)', (_theme, dark) => {
    const scheme = dark ? DEFAULT_SCHEME.dark : DEFAULT_SCHEME.light;
    const tone = (color: string): number => Math.round(Hct.fromInt(argbFromHex(color)).tone);
    for (const label of LABEL_COLORS) {
      const roles = labelRoles(label, dark);
      expect
        .soft(tone(roles.surfaceContainerLowest), label)
        .toBe(tone(scheme.surfaceContainerLowest));
      expect.soft(tone(roles.surfaceContainerLow), label).toBe(tone(scheme.surfaceContainerLow));
      expect.soft(tone(roles.surfaceContainerHigh), label).toBe(tone(scheme.surfaceContainerHigh));
    }
  });

  it.each(THEMES)(
    'draws the stripe of a lesson at 3:1 on lists and dialogs (%s)',
    (_theme, dark) => {
      const scheme = dark ? DEFAULT_SCHEME.dark : DEFAULT_SCHEME.light;
      const grounds = [
        scheme.surfaceContainerLowest,
        scheme.surfaceContainerLow,
        scheme.surfaceContainer,
        scheme.surfaceContainerHigh,
      ];
      for (const label of LABEL_COLORS) {
        for (const ground of grounds) {
          expect
            .soft(contrast(labelRoles(label, dark).color, ground), label)
            .toBeGreaterThanOrEqual(3);
        }
      }
    },
  );

  it.each(THEMES)('keeps the containers of the labels apart (%s)', (_theme, dark) => {
    for (const [index, first] of LABEL_COLORS.entries()) {
      for (const second of LABEL_COLORS.slice(index + 1)) {
        const distance = difference(
          labelRoles(first, dark).container,
          labelRoles(second, dark).container,
        );
        expect.soft(distance, `${first} / ${second}`).toBeGreaterThanOrEqual(10);
      }
    }
  });

  it('keeps the reference color in the light container (Fidelity)', () => {
    expect(labelRoles('ORANGE', false).container).toBe('#f97316');
  });

  it('names the tokens of both themes after the M3 roles', () => {
    const red = labelRoles('RED', true);

    expect(LABEL_TOKENS.dark['labelRed']).toBe(red.color);
    expect(LABEL_TOKENS.dark['onLabelRed']).toBe(red.onColor);
    expect(LABEL_TOKENS.dark['labelRedContainer']).toBe(red.container);
    expect(LABEL_TOKENS.dark['onLabelRedContainer']).toBe(red.onContainer);
    expect(LABEL_TOKENS.dark['labelRedSurfaceContainerLowest']).toBe(red.surfaceContainerLowest);
    expect(LABEL_TOKENS.dark['labelRedSurfaceContainerLow']).toBe(red.surfaceContainerLow);
    expect(LABEL_TOKENS.dark['labelRedSurfaceContainerHigh']).toBe(red.surfaceContainerHigh);
    expect(LABEL_TOKENS.dark['onLabelRedSurface']).toBe(red.onSurface);
    expect(LABEL_TOKENS.dark['onLabelRedSurfaceVariant']).toBe(red.onSurfaceVariant);
    expect(Object.keys(LABEL_TOKENS.light)).toHaveLength(LABEL_COLORS.length * 9);
  });

  it('tells a label color, its name and its CSS key', () => {
    const label: LabelColor = 'PURPLE';

    expect(isLabelColor(label)).toBe(true);
    expect(isLabelColor('GOLD')).toBe(false);
    expect(isLabelColor(null)).toBe(false);
    expect(labelName(label)).toBe('Пурпурный');
    expect(labelKey(label)).toBe('purple');
  });
});
