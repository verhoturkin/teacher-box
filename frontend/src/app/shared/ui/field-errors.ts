import { DOCUMENT } from '@angular/common';
import {
  DestroyRef,
  Directive,
  ElementRef,
  afterRenderEffect,
  contentChildren,
  inject,
} from '@angular/core';
import { Subscription } from 'rxjs';
import { AbstractControl, NgControl, ValidationErrors, Validators } from '@angular/forms';
import { describeError } from '@core/http/error-messages';
import { problemCode } from '@core/http/problem-detail';

let nextId = 0;

function characters(count: number): string {
  const tens = count % 100;
  const ones = count % 10;
  if (tens >= 11 && tens <= 14) {
    return 'символов';
  }
  if (ones === 1) {
    return 'символ';
  }
  return ones >= 2 && ones <= 4 ? 'символа' : 'символов';
}

function numberOf(value: unknown, key: string): number {
  if (typeof value === 'object' && value !== null) {
    const entry: unknown = Object.entries(value).find(([name]) => name === key)?.[1];
    return typeof entry === 'number' ? entry : 0;
  }
  return 0;
}

/**
 * The text of a field error (ADR-0024) by its validator; `server` is the message the server gave for
 * the field. Other errors are explained by their forms themselves: none here.
 */
export function errorText(errors: ValidationErrors | null): string | null {
  if (errors === null) {
    return null;
  }
  const server: unknown = errors['server'];
  if (typeof server === 'string') {
    return server;
  }
  if ('required' in errors) {
    return 'Заполните поле';
  }
  if ('email' in errors) {
    return 'Неверный адрес e-mail';
  }
  if ('minlength' in errors) {
    const length = numberOf(errors['minlength'], 'requiredLength');
    return `Не короче ${String(length)} ${characters(length)}`;
  }
  if ('maxlength' in errors) {
    const length = numberOf(errors['maxlength'], 'requiredLength');
    return `Не длиннее ${String(length)} ${characters(length)}`;
  }
  if ('min' in errors) {
    return `Не меньше ${String(numberOf(errors['min'], 'min'))}`;
  }
  if ('max' in errors) {
    return `Не больше ${String(numberOf(errors['max'], 'max'))}`;
  }
  if ('pattern' in errors) {
    return 'Неверный формат';
  }
  return null;
}

/** The error text of one field of a form: kept in step with its control. */
class FieldError {
  private readonly id = `tb-field-error-${String(nextId++)}`;
  private message: HTMLElement | null = null;
  private readonly subscription: Subscription;

  constructor(
    private readonly control: AbstractControl,
    private readonly host: HTMLElement,
    private readonly document: Document,
  ) {
    if (control.hasValidator(Validators.required)) {
      this.input().setAttribute('aria-required', 'true');
      this.field()?.classList.add('tb-field--required');
    }
    this.subscription = control.events.subscribe(() => {
      this.show();
    });
    this.show();
  }

  dispose(): void {
    this.subscription.unsubscribe();
    this.message?.remove();
  }

  /** The element that takes the text: the input itself or the one inside a PrimeNG field. */
  private input(): HTMLElement {
    if (this.host.matches('input, textarea, select')) {
      return this.host;
    }
    return this.host.querySelector<HTMLElement>('input, textarea, [role="combobox"]') ?? this.host;
  }

  private field(): HTMLElement | null {
    return this.host.closest<HTMLElement>('.tb-field');
  }

  private show(): void {
    const control = this.control;
    const input = this.input();
    const wrong = control.invalid && control.touched;
    if (wrong) {
      input.setAttribute('aria-invalid', 'true');
    } else {
      input.removeAttribute('aria-invalid');
    }
    const text = wrong ? errorText(control.errors) : null;
    const field = this.field();
    if (text === null || field === null) {
      this.message?.remove();
      this.message = null;
      input.removeAttribute('aria-describedby');
      return;
    }
    if (this.message === null) {
      this.message = this.document.createElement('small');
      this.message.id = this.id;
      this.message.className = 'tb-field__error';
    }
    this.message.textContent = text;
    if (this.message.parentElement !== field) {
      // under the field, after the control (a row of the field keeps the error under the whole row)
      const row = this.host.closest('.tb-copy-row, .tb-inline');
      const after = row !== null && field.contains(row) ? row : this.host;
      after.after(this.message);
    }
    input.setAttribute('aria-describedby', this.id);
  }
}

/**
 * Errors of the fields of a form as text under the fields (M3 supporting text, ADR-0024):
 * `<form [formGroup]="form" tbFieldErrors>`. A wrong value shows its error once the field was
 * touched (or the form was sent), the input gets `aria-invalid` and `aria-describedby`; a required
 * field is marked (`tb-field--required`, `aria-required`).
 */
@Directive({ selector: '[tbFieldErrors]' })
export class FieldErrors {
  private readonly controls = contentChildren(NgControl, { descendants: true });
  private readonly elements = contentChildren(NgControl, { descendants: true, read: ElementRef });
  private readonly document = inject(DOCUMENT);
  private readonly fields = new Map<NgControl, FieldError>();

  constructor() {
    afterRenderEffect(() => {
      const controls = this.controls();
      const elements = this.elements();
      const current = new Set(controls);
      for (const [control, field] of this.fields) {
        if (!current.has(control)) {
          field.dispose();
          this.fields.delete(control);
        }
      }
      controls.forEach((control, index) => {
        const element: unknown = elements[index]?.nativeElement;
        const model = control.control;
        if (!this.fields.has(control) && model !== null && element instanceof HTMLElement) {
          this.fields.set(control, new FieldError(model, element, this.document));
        }
      });
    });
    inject(DestroyRef).onDestroy(() => {
      for (const field of this.fields.values()) {
        field.dispose();
      }
    });
  }
}

/**
 * An error the server gave for a field (its code, e.g. `login.taken`) goes under that field, not
 * under the form (ADR-0024).
 *
 * @param fields the control of the field by the codes of its errors
 * @return whether the error belongs to a field
 */
export function showAtField(
  error: unknown,
  fields: Readonly<Record<string, AbstractControl>>,
): boolean {
  const code = problemCode(error);
  const control = code === null ? undefined : fields[code];
  if (control === undefined) {
    return false;
  }
  control.setErrors({ server: describeError(error, 'Проверьте значение') });
  control.markAsTouched();
  return true;
}

/**
 * Before a form is sent (ADR-0024): a form with wrong values shows the errors of all its fields and
 * takes the focus to the first wrong one instead of disabling its button.
 *
 * @return whether the form may be sent
 */
export function revealErrors(form: AbstractControl): boolean {
  if (form.valid) {
    return true;
  }
  form.markAllAsTouched();
  setTimeout(() => {
    document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  });
  return false;
}
