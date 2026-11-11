import { ChangeDetectionStrategy, Component } from '@angular/core';
import { InputText } from 'primeng/inputtext';
import { Textarea } from 'primeng/textarea';

/**
 * §9 The M3 filled text field `.tb-field`: the label first, then the control, then the optional hint; the
 * one field style of every form control.
 */
@Component({
  selector: 'tb-gallery-text-fields',
  imports: [InputText, Textarea],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="tb-form tb-form--narrow">
      <div class="tb-field">
        <label for="gallery-name">Name</label>
        <input pInputText id="gallery-name" />
        <small class="tb-hint">Optional supporting text: small.tb-hint</small>
      </div>
      <div class="tb-field">
        <label for="gallery-filled">Populated</label>
        <input pInputText id="gallery-filled" value="Anna Petrova" />
      </div>
      <div class="tb-field">
        <label for="gallery-text">Description</label>
        <textarea pTextarea id="gallery-text" rows="3"></textarea>
      </div>
      <div class="tb-field">
        <label for="gallery-disabled">Disabled</label>
        <input pInputText id="gallery-disabled" value="Read only" disabled />
      </div>
      <code class="tb-gallery-name"
        >div.tb-field > label + input[pInputText] | textarea[pTextarea] + small.tb-hint</code
      >
    </div>
  `,
})
export class TextFieldsSample {}
