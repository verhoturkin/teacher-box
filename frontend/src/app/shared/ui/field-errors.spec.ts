import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { hostElement, typeInto } from '@testing/dom';
import { FieldErrors, errorText, revealErrors, showAtField } from './field-errors';

@Component({
  imports: [ReactiveFormsModule, FieldErrors],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form [formGroup]="form" tbFieldErrors>
      <div class="tb-field">
        <label for="name">Имя</label>
        <input id="name" formControlName="name" />
        <small class="tb-hint">Как в журнале</small>
      </div>
      <div class="tb-field">
        <label for="note">Заметка</label>
        <input id="note" formControlName="note" />
      </div>
    </form>
  `,
})
class Host {
  readonly form = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    note: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(3)] }),
  });
}

describe('field errors', () => {
  it('explains the errors of the validators in Russian', () => {
    expect(errorText(null)).toBeNull();
    expect(errorText({ required: true })).toBe('Заполните поле');
    expect(errorText({ email: true })).toBe('Неверный адрес e-mail');
    expect(errorText({ minlength: { requiredLength: 8, actualLength: 3 } })).toBe(
      'Не короче 8 символов',
    );
    expect(errorText({ minlength: { requiredLength: 1 } })).toBe('Не короче 1 символ');
    expect(errorText({ maxlength: { requiredLength: 3 } })).toBe('Не длиннее 3 символа');
    expect(errorText({ maxlength: { requiredLength: 12 } })).toBe('Не длиннее 12 символов');
    expect(errorText({ min: { min: 1 } })).toBe('Не меньше 1');
    expect(errorText({ max: { max: 600 } })).toBe('Не больше 600');
    expect(errorText({ max: 'odd' })).toBe('Не больше 0');
    expect(errorText({ pattern: {} })).toBe('Неверный формат');
    expect(errorText({ server: 'Этот логин уже занят' })).toBe('Этот логин уже занят');
    expect(errorText({ mismatch: true })).toBeNull();
  });

  it('shows the error under a touched field, marks required fields and focuses the first wrong one', async () => {
    const fixture = TestBed.createComponent(Host);
    document.body.append(hostElement(fixture));
    await fixture.whenStable();
    const host = hostElement(fixture);
    const name = host.querySelector<HTMLInputElement>('#name');

    expect(name?.getAttribute('aria-required')).toBe('true');
    expect(host.querySelector('.tb-field')?.classList).toContain('tb-field--required');
    expect(host.querySelector('.tb-field__error')).toBeNull();

    expect(revealErrors(fixture.componentInstance.form)).toBe(false);
    await new Promise((resolve) => setTimeout(resolve, 10));

    const error = host.querySelector('.tb-field__error');
    expect(error?.textContent).toBe('Заполните поле');
    expect(name?.getAttribute('aria-invalid')).toBe('true');
    expect(name?.getAttribute('aria-describedby')).toBe(error?.id);
    expect(document.activeElement).toBe(name);

    if (name !== null) {
      typeInto(name, 'Анна');
    }
    await fixture.whenStable();
    expect(host.querySelector('.tb-field__error')).toBeNull();
    expect(name?.hasAttribute('aria-invalid')).toBe(false);
    expect(revealErrors(fixture.componentInstance.form)).toBe(true);
    hostElement(fixture).remove();
    fixture.destroy();
  });

  it('puts an error of the server under its field', () => {
    const login = new FormControl('taken');
    const conflict = new HttpErrorResponse({
      status: 409,
      error: { status: 409, code: 'login.taken' },
    });

    expect(showAtField(conflict, { 'login.taken': login })).toBe(true);
    expect(login.errors).toEqual({ server: 'Этот логин уже занят' });
    expect(login.touched).toBe(true);
    expect(showAtField(conflict, {})).toBe(false);
    expect(showAtField(new Error('boom'), { 'login.taken': login })).toBe(false);
  });
});
