import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { InputText } from 'primeng/inputtext';
import { DEFAULT_PORTAL_NAME } from '@core/portal/portal';
import { MAX_PORTAL_NAME_LENGTH } from '@core/portal/portal-address';
import { T } from '../i18n/texts';

/** The name of the portal (Settings › Портал and the first setup); empty means «Teacher Box». */
@Component({
  selector: 'tb-portal-name-field',
  imports: [ReactiveFormsModule, InputText],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="tb-field">
      <label [for]="inputId()">{{ t.name }}</label>
      <input
        pInputText
        [id]="inputId()"
        [formControl]="control()"
        [placeholder]="defaultName"
        [maxlength]="maxLength"
        autocomplete="off"
      />
      <small class="tb-hint">{{ t.nameHint }}</small>
    </div>
  `,
})
export class PortalNameField {
  readonly control = input.required<FormControl<string>>();
  readonly inputId = input('portal-name');

  protected readonly t = T.portal;
  protected readonly defaultName = DEFAULT_PORTAL_NAME;
  protected readonly maxLength = MAX_PORTAL_NAME_LENGTH;
}
