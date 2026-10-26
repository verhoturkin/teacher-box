import { Signal, WritableSignal, effect, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormGroup } from '@angular/forms';
import { EMPTY, Observable, map } from 'rxjs';
import { describeError } from '@core/http/error-messages';
import { revealErrors } from '../field-errors';

/** The raw value of the form `F` (`undefined` for a dialog without a form). */
type FormValue<F> = F extends FormGroup ? ReturnType<F['getRawValue']> : undefined;

/** The options as the implementation sees them (the overloads below are the checked API). */
type LooseOptions<T> = Omit<DialogSubmitOptions<T, FormGroup | undefined>, 'request'> & {
  // a method, so that its parameter is checked bivariantly against the overloads
  request(value: unknown): Observable<T>;
};

/** What `dialogSubmit` needs; `T` is the answer of the request, `F` the form of the dialog. */
export interface DialogSubmitOptions<T, F extends FormGroup | undefined> {
  /** The dialog's `[(visible)]`: the state resets whenever it opens, it closes after a success. */
  visible: WritableSignal<boolean>;
  /** The form of the dialog: reset on open, checked (`revealErrors`) before the request. */
  form?: F;
  /** Fills the form on open instead of `form.reset()` (an edit form takes its values from an input). */
  reset?: () => void;
  /** The text when the server gave no reason. */
  failed: string;
  /** The request; `value` is the raw value of the form. */
  request: (value: FormValue<F>) => Observable<T>;
  /** Called after the dialog closed on success. */
  done?: (result: T) => void;
}

/** The state of one dialog's request. */
export interface DialogSubmit {
  readonly pending: Signal<boolean>;
  readonly error: Signal<string | null>;
  /** The form was changed since it opened: `<tb-dialog [dirty]>` asks before it closes. */
  readonly dirty: Signal<boolean>;
  /** The form's submit: validates, sends once, closes on success, shows the failure. */
  run(): void;
}

/**
 * The submit of a dialog (ADR-0050): the pending flag, the error, the reset on open, the check of the
 * form, the request and the close. The dialog is `<tb-dialog [pending]="submit.pending()"
 * [error]="submit.error()">`, its form `(ngSubmit)="submit.run()"`. Call in an injection context.
 */
export function dialogSubmit<T, F extends FormGroup>(
  options: DialogSubmitOptions<T, F> & { form: F },
): DialogSubmit;
export function dialogSubmit<T>(options: DialogSubmitOptions<T, undefined>): DialogSubmit;
export function dialogSubmit<T>(options: LooseOptions<T>): DialogSubmit {
  const pending = signal(false);
  const error = signal<string | null>(null);
  const dirty = toSignal(
    (options.form?.valueChanges ?? EMPTY).pipe(map(() => options.form?.dirty === true)),
    {
      initialValue: false,
    },
  );

  effect(() => {
    if (options.visible()) {
      untracked(() => {
        pending.set(false);
        error.set(null);
        if (options.reset === undefined) {
          options.form?.reset();
        } else {
          options.reset();
        }
      });
    }
  });

  function run(): void {
    const form = options.form;
    if (pending() || (form !== undefined && !revealErrors(form))) {
      return;
    }
    pending.set(true);
    error.set(null);
    options.request(form?.getRawValue()).subscribe({
      next: (result) => {
        pending.set(false);
        options.visible.set(false);
        options.done?.(result);
      },
      error: (failure: unknown) => {
        pending.set(false);
        error.set(describeError(failure, options.failed));
      },
    });
  }

  return { pending: pending.asReadonly(), error: error.asReadonly(), dirty, run };
}
