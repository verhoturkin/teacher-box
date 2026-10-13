import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  forwardRef,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { IconField } from 'primeng/iconfield';
import { InputIcon } from 'primeng/inputicon';
import { InputText } from 'primeng/inputtext';
import { SHARED_T } from '@shared/i18n/texts';

/**
 * The M3 search bar of a list (ADR-0022): a filled pill, the magnifier at its start and, while there is
 * text, the round «×» «Очистить поиск» at its end (Esc clears too). The browser's own clear button is
 * hidden. A form control: `<tb-search-field [formControl]="search" [label]="t.search" />` or `[ngModel]`.
 */
@Component({
  selector: 'tb-search-field',
  imports: [IconField, InputIcon, InputText],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => SearchField), multi: true },
  ],
  template: `
    <p-iconfield>
      <p-inputicon styleClass="pi pi-search" />
      <input
        #field
        pInputText
        type="search"
        enterkeyhint="search"
        autocomplete="off"
        [value]="value()"
        [placeholder]="placeholder() ?? label()"
        [attr.aria-label]="label()"
        [disabled]="disabled()"
        (input)="type(field.value)"
        (keydown.escape)="clear($event)"
        (blur)="touched()"
      />
      @if (value() !== '') {
        <button
          type="button"
          class="tb-search-field__clear"
          [attr.aria-label]="clearLabel"
          (click)="clear()"
        >
          <i class="pi pi-times" aria-hidden="true"></i>
        </button>
      }
    </p-iconfield>
  `,
  styles: `
    :host {
      display: inline-block;
    }

    p-iconfield {
      display: block;
    }

    /* M3 docked search, 56 px: 4 + 48 + 4 around the icons, the text between them */
    input {
      width: 100%;
      padding-inline-end: 3.5rem;

      /* the browser's «×» of a search field: the bar has its own */
      &::-webkit-search-cancel-button,
      &::-webkit-search-decoration {
        appearance: none;
      }
    }

    /*
     * M3 trailing icon button: 48 px, 4 px from the end — its centre is the centre of the round end of
     * the bar; on-surface-variant, the state layer on hover
     */
    .tb-search-field__clear {
      position: absolute;
      inset-block-start: 50%;
      inset-inline-end: var(--tb-space-1);
      display: flex;
      align-items: center;
      justify-content: center;
      width: 3rem;
      height: 3rem;
      border: none;
      border-radius: var(--tb-shape-full);
      background: transparent;
      color: var(--p-md-on-surface-variant);
      cursor: pointer;
      transform: translateY(-50%);

      &:hover {
        background: color-mix(in srgb, var(--p-md-on-surface) var(--tb-state-hover), transparent);
      }

      &:focus-visible {
        outline: 2px solid var(--p-md-primary);
        outline-offset: 0;
      }
    }
  `,
})
export class SearchField implements ControlValueAccessor {
  protected readonly clearLabel = SHARED_T.common.clearSearch;
  private readonly field = viewChild.required<ElementRef<HTMLInputElement>>('field');

  /** The name of the field for screen readers, e.g. «Поиск досок»; the placeholder when none is given. */
  readonly label = input.required<string>();
  /** What to type, e.g. «Название или ученик». */
  readonly placeholder = input<string>();

  protected readonly value = signal('');
  protected readonly disabled = signal(false);
  private onChange: (value: string) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  writeValue(value: unknown): void {
    this.value.set(typeof value === 'string' ? value : '');
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(disabled: boolean): void {
    this.disabled.set(disabled);
  }

  protected type(value: string): void {
    this.value.set(value);
    this.onChange(value);
  }

  /** Empties the field and keeps the focus in it. Esc in an empty field is left to the page (a dialog). */
  protected clear(event?: Event): void {
    if (this.value() === '') {
      return;
    }
    event?.stopPropagation();
    this.type('');
    this.field().nativeElement.focus();
  }

  protected touched(): void {
    this.onTouched();
  }
}
