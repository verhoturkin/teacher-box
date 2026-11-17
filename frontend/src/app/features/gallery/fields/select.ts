import { ChangeDetectionStrategy, Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MultiSelect } from 'primeng/multiselect';
import { Select } from 'primeng/select';

/** §9 Composite controls in `.tb-field`: select, multiselect. */
@Component({
  selector: 'tb-gallery-select-fields',
  imports: [FormsModule, Select, MultiSelect],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="tb-form tb-form--narrow">
      <div class="tb-field">
        <label for="gallery-select">Duration</label>
        <p-select
          inputId="gallery-select"
          [options]="durations"
          [(ngModel)]="duration"
          appendTo="body"
          [fluid]="true"
        />
      </div>
      <div class="tb-field">
        <label for="gallery-multi">Days</label>
        <p-multiselect
          inputId="gallery-multi"
          [options]="days"
          [(ngModel)]="chosen"
          appendTo="body"
          [fluid]="true"
        />
      </div>
      <code class="tb-gallery-name">.tb-field > p-select | p-multiselect, appendTo="body"</code>
    </div>
  `,
})
export class SelectFieldsSample {
  protected readonly durations = ['30 min', '45 min', '60 min', '90 min'];
  protected duration = '60 min';
  protected readonly days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  protected chosen = ['Monday'];
}
