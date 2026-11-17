import { ChangeDetectionStrategy, Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DateField } from '@shared/ui/date-field';

/** §9 «Date» `tb-date-field`: typed entry, the docked picker (full screen on compact), a month field. */
@Component({
  selector: 'tb-gallery-date-fields',
  imports: [FormsModule, DateField],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="tb-form tb-form--narrow">
      <div class="tb-field">
        <label for="gallery-date">Date</label>
        <tb-date-field inputId="gallery-date" label="Date" [(ngModel)]="date" />
      </div>
      <div class="tb-field">
        <label for="gallery-date-range">This month only</label>
        <tb-date-field
          inputId="gallery-date-range"
          label="This month only"
          [minDate]="first"
          [maxDate]="last"
          [(ngModel)]="inRange"
        />
      </div>
      <div class="tb-field">
        <label for="gallery-month">Month</label>
        <tb-date-field inputId="gallery-month" label="Month" [month]="true" [(ngModel)]="month" />
      </div>
      <code class="tb-gallery-name"
        >tb-date-field [inputId] [label] [minDate] [maxDate] [month]</code
      >
    </div>
  `,
})
export class DateFieldsSample {
  private readonly today = new Date();
  protected readonly first = new Date(this.today.getFullYear(), this.today.getMonth(), 1);
  protected readonly last = new Date(this.today.getFullYear(), this.today.getMonth() + 1, 0);
  protected date: Date | null = new Date(2026, 7, 17);
  protected inRange: Date | null = null;
  protected month: Date | null = this.first;
}
