import { ChangeDetectionStrategy, Component, effect, inject, input, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Button } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { Portal } from './portal';
import { MAX_ADDRESS_LENGTH } from './portal-address';
import { FieldErrors } from '@shared/ui/field-errors';
import { PortalAddressWarnings } from './portal-address-warnings';
import { AddressCheck, checkAddress } from './portal-address-check';
import { CHECK_T } from './portal-address-check-texts';
import { CORE_T } from '@core/i18n/texts';

/**
 * The address of the portal in a form: the field, «Как в браузере» and the warnings about addresses
 * students cannot open.
 */
@Component({
  selector: 'tb-portal-address-field',
  imports: [ReactiveFormsModule, Button, InputText, PortalAddressWarnings, FieldErrors],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: '../../shared/ui/support-hint.scss',
  template: `
    <div class="tb-field" tbFieldErrors>
      <label [for]="inputId()">{{ t.label }}</label>
      <div class="tb-copy-row">
        <input
          pInputText
          [id]="inputId()"
          [formControl]="control()"
          [maxlength]="maxLength"
          placeholder="https://school.example.com"
          autocomplete="url"
          class="tb-grow"
        />
        @if (checkable()) {
          <p-button
            [label]="c.check"
            severity="secondary"
            [loading]="checking()"
            (onClick)="check()"
          />
        } @else {
          <p-button [label]="t.asInBrowser" severity="secondary" (onClick)="useOpenedAt()" />
        }
      </div>
      <small class="tb-hint tb-support-lines">
        <span role="status">
          @switch (checked()) {
            @case ('opens') {
              <span class="tb-hint--icon tb-positive"
                ><i class="tb-i tb-i-check_circle" aria-hidden="true"></i>{{ c.opens }}</span
              >
            }
            @case ('fails') {
              <span class="tb-hint--icon tb-error"
                ><i class="tb-i tb-i-error" aria-hidden="true"></i>{{ c.fails }}</span
              >
            }
          }
        </span>
        <span>{{ t.hint }}</span>
      </small>
      @if (control().invalid && control().touched) {
        <small class="tb-error">{{ t.invalid }}</small>
      }
      <tb-portal-address-warnings [address]="value()" />
    </div>
  `,
})
export class PortalAddressField {
  private readonly portal = inject(Portal);

  readonly control = input.required<FormControl<string>>();
  readonly inputId = input('portal-address');
  /** «Проверить» instead of «Как в браузере» (the first setup, sketch OnbPortal). */
  readonly checkable = input(false);

  protected readonly t = CORE_T.portalAddress;
  protected readonly c = CHECK_T;
  protected readonly maxLength = MAX_ADDRESS_LENGTH;
  protected readonly value = signal('');
  protected readonly checking = signal(false);
  /** The result of «Проверить» for the address as it is now; a change forgets it. */
  protected readonly checked = signal<AddressCheck | null>(null);

  constructor() {
    effect((onCleanup) => {
      const control = this.control();
      this.value.set(control.value);
      const subscription = control.valueChanges.subscribe((value) => {
        this.value.set(value);
        this.checked.set(null);
      });
      onCleanup(() => {
        subscription.unsubscribe();
      });
    });
  }

  async check(): Promise<void> {
    this.checking.set(true);
    const result = await checkAddress(this.control().value, this.portal.openedAt());
    this.checking.set(false);
    this.checked.set(result);
  }

  useOpenedAt(): void {
    this.control().setValue(this.portal.openedAt());
    this.control().markAsDirty();
  }
}
