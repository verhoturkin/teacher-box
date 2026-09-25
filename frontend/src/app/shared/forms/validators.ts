import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/** Group validator: the two controls must have equal values (e.g. password and its confirmation). */
export function fieldsMatch(field: string, confirmation: string): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    const value: unknown = group.get(field)?.value;
    const confirmed: unknown = group.get(confirmation)?.value;
    return value === confirmed ? null : { fieldsMismatch: true };
  };
}

/** Minimal password length, mirrors the backend password policy. */
export const PASSWORD_MIN_LENGTH = 8;
