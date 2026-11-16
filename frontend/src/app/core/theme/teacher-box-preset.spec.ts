import { TeacherBoxPreset } from './teacher-box-preset';

function buttonCss(): string {
  const button: unknown = TeacherBoxPreset.components?.button;
  if (typeof button === 'object' && button !== null && 'css' in button) {
    if (typeof button.css === 'string') return button.css;
  }
  throw new Error('the button preset has no css');
}

describe('Teacher Box preset', () => {
  it('sets the button label in M3 Label Large, leaving sm and lg their own size', () => {
    const css = buttonCss();
    expect(css).toContain('.p-button:not(.p-button-sm, .p-button-lg) {');
    expect(css).toMatch(/font-size: 0\.875rem;\s+letter-spacing: var\(--tb-tracking-label-l\);/);
  });
});
