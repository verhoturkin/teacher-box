import { ChangeDetectionStrategy, Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { InputNumber } from 'primeng/inputnumber';
import { Password } from 'primeng/password';
import { PasswordToggle } from '@shared/ui/password-toggle';

/**
 * §9 Numbers and passwords: `p-inputnumber.tb-stepper` («− N +», ours) and the number field of a form;
 * `p-password` with `tb-password-toggle` in its show and hide templates.
 */
@Component({
  selector: 'tb-gallery-stepper',
  imports: [FormsModule, InputNumber, Password, PasswordToggle],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="tb-form tb-form--narrow">
      <div class="tb-gallery-cell">
        <p-inputnumber
          styleClass="tb-stepper"
          inputId="gallery-points"
          [showButtons]="true"
          buttonLayout="horizontal"
          incrementButtonIcon="tb-i tb-i-add"
          decrementButtonIcon="tb-i tb-i-remove"
          [min]="1"
          [max]="10"
          ariaLabel="Points"
          [(ngModel)]="points"
        />
        <code class="tb-gallery-name"
          >p-inputnumber styleClass="tb-stepper" buttonLayout="horizontal"</code
        >
      </div>
      <div class="tb-field">
        <label for="gallery-price">Price</label>
        <p-inputnumber
          inputId="gallery-price"
          [(ngModel)]="price"
          [showButtons]="true"
          [fluid]="true"
        />
      </div>
      <div class="tb-field">
        <label for="gallery-password">Password</label>
        <p-password
          inputId="gallery-password"
          [feedback]="false"
          [toggleMask]="true"
          [fluid]="true"
        >
          <ng-template #showicon><tb-password-toggle /></ng-template>
          <ng-template #hideicon><tb-password-toggle [shown]="true" /></ng-template>
        </p-password>
      </div>
    </div>
  `,
})
export class StepperSample {
  protected points = 2;
  protected price = 1500;
}
