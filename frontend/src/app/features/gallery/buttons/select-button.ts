import { ChangeDetectionStrategy, Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SelectButton } from 'primeng/selectbutton';

/**
 * §8 `p-selectbutton`: the connected button group of a form value (the theme, a language) — 2 dp apart, the
 * chosen one primary and fully round. Toggles only.
 */
@Component({
  selector: 'tb-gallery-select-button',
  imports: [FormsModule, SelectButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="tb-gallery-cell">
      <span id="gallery-theme-label" class="tb-section-label">Theme</span>
      <p-selectbutton
        [options]="options"
        optionLabel="label"
        optionValue="value"
        [allowEmpty]="false"
        ariaLabelledBy="gallery-theme-label"
        [(ngModel)]="value"
      />
      <code class="tb-gallery-name">p-selectbutton [allowEmpty]="false" ariaLabelledBy</code>
    </div>
  `,
})
export class SelectButtonSample {
  protected readonly options = [
    { label: 'Light', value: 'light' },
    { label: 'Dark', value: 'dark' },
    { label: 'System', value: 'system' },
  ];
  protected value = 'system';
}
