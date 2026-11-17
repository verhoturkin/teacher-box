import { Directive, output, signal } from '@angular/core';
import { ControlValueAccessor, ValidationErrors, Validator } from '@angular/forms';

/**
 * The typed entry of the date and time fields (ADR-0067): the field keeps the text as typed and
 * parses it only on Enter or leaving the field; text that is no value stays and gives the field's
 * own error. A picker sets the value with `choose`.
 */
@Directive()
export abstract class TypedField<V> implements ControlValueAccessor, Validator {
  /** The person changed the value: typed and committed, or picked (for fields that save at once). */
  readonly changed = output<V | null>();
  protected readonly text = signal('');
  protected readonly disabled = signal(false);
  protected readonly value = signal<V | null>(null);
  /** The typed text is not a value. */
  private wrong = false;

  private onChange: (value: V | null) => void = () => undefined;
  protected onTouched: () => void = () => undefined;
  private onValidatorChange: () => void = () => undefined;

  /** The value a form gives the field, or `null`. */
  protected abstract read(value: unknown): V | null;
  protected abstract parse(text: string): V | null;
  protected abstract format(value: V): string;
  /** The error of text that is no value. */
  protected abstract wrongError(): ValidationErrors;

  /** The errors of a value (out of bounds), `null` when it is fine. */
  protected abstract check(value: V): ValidationErrors | null;

  protected same(a: V | null, b: V | null): boolean {
    return a === b;
  }

  writeValue(value: unknown): void {
    const read = this.read(value);
    this.value.set(read);
    this.text.set(read === null ? '' : this.format(read));
    this.wrong = false;
  }

  registerOnChange(fn: (value: V | null) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  registerOnValidatorChange(fn: () => void): void {
    this.onValidatorChange = fn;
  }

  setDisabledState(disabled: boolean): void {
    this.disabled.set(disabled);
  }

  validate(): ValidationErrors | null {
    if (this.wrong) {
      return this.wrongError();
    }
    const value = this.value();
    return value === null ? null : this.check(value);
  }

  /** Enter or leaving the field: the typed text becomes the value; text that is no value stays. */
  protected readText(): void {
    const text = this.text().trim();
    const value = this.parse(text);
    const wrong = text !== '' && value === null;
    if (!wrong) {
      this.text.set(value === null ? '' : this.format(value));
    }
    this.setWrong(wrong);
    this.commit(value);
  }

  /** A value picked in the picker. */
  protected choose(value: V): void {
    this.text.set(this.format(value));
    this.setWrong(false);
    this.commit(value);
  }

  private setWrong(wrong: boolean): void {
    if (wrong !== this.wrong) {
      this.wrong = wrong;
      this.onValidatorChange();
    }
  }

  private commit(value: V | null): void {
    if (!this.same(value, this.value())) {
      this.value.set(value);
      this.onChange(value);
      this.changed.emit(value);
    }
  }
}
