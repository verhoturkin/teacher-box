import { arrowStep, reordered } from './reorder';

describe('reorder', () => {
  it('moves an item and reads the arrow keys', () => {
    expect(reordered(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a']);
    expect(reordered(['a'], 3, 0)).toEqual(['a']);
    expect(arrowStep(new KeyboardEvent('keydown', { key: 'ArrowUp' }))).toBe(-1);
    expect(arrowStep(new KeyboardEvent('keydown', { key: 'ArrowDown' }))).toBe(1);
    expect(arrowStep(new KeyboardEvent('keydown', { key: 'Enter' }))).toBeNull();
  });
});
