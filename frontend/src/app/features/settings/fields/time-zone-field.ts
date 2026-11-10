import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Select } from 'primeng/select';
import { T } from '../i18n/texts';
import { Option, deviceZone, zoneOptions } from '../lesson-options';
import { controlValue } from './control-value';

/**
 * The time zone of the portal (Settings › Занятия and the first setup): the device's zone first, a note when
 * the chosen one is it. Saving is the host's: `committed` after a choice.
 */
@Component({
  selector: 'tb-time-zone-field',
  imports: [ReactiveFormsModule, Select],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: '../../../shared/ui/support-hint.scss',
  template: `
    <div class="tb-field">
      <label [for]="inputId()">{{ t.timeZoneLabel }}</label>
      <p-select
        [inputId]="inputId()"
        optionLabel="label"
        optionValue="value"
        appendTo="body"
        [filter]="true"
        filterBy="label"
        [options]="zones()"
        [formControl]="control()"
        (onChange)="committed.emit($event.value)"
      />
      <small class="tb-hint tb-support-lines">
        @if (value() === device) {
          <span class="tb-hint--icon"
            ><i class="tb-i tb-i-devices" aria-hidden="true"></i>{{ t.timeZoneDevice }}</span
          >
        }
        <span>{{ t.timeZoneHint }}</span>
      </small>
    </div>
  `,
})
export class TimeZoneField {
  readonly control = input.required<FormControl<string>>();
  readonly inputId = input('time-zone-input');
  /** A zone was chosen. */
  readonly committed = output<string>();

  protected readonly t = T.page;
  protected readonly device = deviceZone();
  protected readonly value = controlValue(() => this.control());
  protected readonly zones = computed<Option[]>(() => {
    const zone = this.value();
    return zone === undefined || zone === '' ? [] : zoneOptions(zone, this.device);
  });
}
