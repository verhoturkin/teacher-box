import { computedColors } from './computed-colors';
import { DEFAULT_ROLES, ENGINE_STAMP, LABEL_ROLES } from './generated-colors';

describe('generated colors', () => {
  // a failure here: run `npm run colors` and commit generated-colors.ts
  it('are what the color engine computes from the same constants', () => {
    const computed = computedColors();

    expect(DEFAULT_ROLES).toEqual(computed.DEFAULT_ROLES);
    expect(LABEL_ROLES).toEqual(computed.LABEL_ROLES);
    expect(ENGINE_STAMP).toBe(computed.ENGINE_STAMP);
  });
});
