import { ChangeDetectionStrategy, Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DateTimeField } from '@shared/ui/date-time-field';
import { TimeField } from '@shared/ui/time-field';

/**
 * §9 «Time» `tb-time-field`: typed entry and the M3 time picker (dial and input views), a step;
 * §9 «Date and time» `tb-date-time-field`: the date and time fields in one row, nothing before now.
 */
@Component({
  selector: 'tb-gallery-time-fields',
  imports: [FormsModule, DateTimeField, TimeField],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="tb-form tb-form--narrow">
      <div class="tb-field">
        <label for="gallery-time">Time</label>
        <tb-time-field inputId="gallery-time" [(ngModel)]="time" />
      </div>
      <div class="tb-field">
        <label for="gallery-time-step">Every 15 minutes</label>
        <tb-time-field inputId="gallery-time-step" [step]="15" [(ngModel)]="quarter" />
      </div>
      <code class="tb-gallery-name">tb-time-field [inputId] [step] (changed) → tb-time-picker</code>
      <div class="tb-field">
        <tb-date-time-field
          inputId="gallery-date-time"
          label="Not before now"
          [minDate]="now"
          [(ngModel)]="moment"
        />
      </div>
      <code class="tb-gallery-name">tb-date-time-field [inputId] [label] [minDate] [step]</code>
    </div>
  `,
})
export class TimeFieldsSample {
  protected time: string | null = '14:30';
  protected quarter: string | null = null;
  protected readonly now = new Date();
  protected moment: Date | null = null;
}
