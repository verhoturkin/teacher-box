import { ChangeDetectionStrategy, Component, effect, inject, input, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Button } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { Portal } from './portal';
import { MAX_ADDRESS_LENGTH } from './portal-address';
import { FieldErrors } from '@shared/ui/field-errors';
import { PortalAddressWarnings } from './portal-address-warnings';

/**
 * The address of the portal in a form: the field, «Как в браузере» and the warnings about addresses
 * students cannot open. Read-only when the server sets the address.
 */
@Component({
  selector: 'tb-portal-address-field',
  imports: [ReactiveFormsModule, Button, InputText, PortalAddressWarnings, FieldErrors],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="tb-field" tbFieldErrors>
      <label [for]="inputId()">Адрес портала</label>
      <div class="tb-copy-row">
        <input
          pInputText
          [id]="inputId()"
          [formControl]="control()"
          [readonly]="fromEnvironment()"
          [maxlength]="maxLength"
          placeholder="https://school.example.com"
          autocomplete="url"
          class="tb-grow"
        />
        @if (!fromEnvironment()) {
          <p-button label="Как в браузере" severity="secondary" (onClick)="useOpenedAt()" />
        }
      </div>
      @if (fromEnvironment() && administrator()) {
        <small class="tb-hint">
          Адрес задан в настройках сервера (TEACHERBOX_PUBLIC_URL) — поменять его можно там.
        </small>
      } @else if (fromEnvironment()) {
        <small class="tb-hint">
          Адрес задан администратором портала — чтобы его поменять, попросите администратора.
        </small>
      } @else {
        <small class="tb-hint">
          По этому адресу ученики открывают портал. С него начинаются ссылки-приглашения, ссылки в
          сообщениях ботов и подписка на календарь.
        </small>
      }
      @if (control().invalid && control().touched) {
        <small class="tb-error"
          >Нужен адрес вида https://school.example.com — без пути после адреса.</small
        >
      }
      <tb-portal-address-warnings [address]="value()" />
    </div>
  `,
})
export class PortalAddressField {
  private readonly portal = inject(Portal);

  readonly control = input.required<FormControl<string>>();
  readonly fromEnvironment = input(false);
  /** The administrator reads the name of the variable; the teacher is told to ask the administrator. */
  readonly administrator = input(false);
  readonly inputId = input('portal-address');

  protected readonly maxLength = MAX_ADDRESS_LENGTH;
  protected readonly value = signal('');

  constructor() {
    effect((onCleanup) => {
      const control = this.control();
      this.value.set(control.value);
      const subscription = control.valueChanges.subscribe((value) => {
        this.value.set(value);
      });
      onCleanup(() => {
        subscription.unsubscribe();
      });
    });
  }

  useOpenedAt(): void {
    this.control().setValue(this.portal.openedAt());
    this.control().markAsDirty();
  }
}
