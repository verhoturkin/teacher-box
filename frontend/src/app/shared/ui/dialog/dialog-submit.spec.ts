import { Injector, runInInjectionContext, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NonNullableFormBuilder, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable, Subject, throwError } from 'rxjs';
import { testProviders } from '@testing/setup';
import { dialogSubmit } from './dialog-submit';

describe('dialogSubmit', () => {
  function setup(request: (value: { name: string }) => Observable<string>) {
    TestBed.configureTestingModule({ providers: testProviders() });
    const visible = signal(false);
    const form = TestBed.inject(NonNullableFormBuilder).group({
      name: ['', Validators.required],
    });
    const done = vi.fn();
    const submit = runInInjectionContext(TestBed.inject(Injector), () =>
      dialogSubmit({ visible, form, failed: 'Не удалось', request, done }),
    );
    return { visible, form, done, submit };
  }

  function open(visible: ReturnType<typeof signal<boolean>>): void {
    visible.set(true);
    TestBed.tick();
  }

  it('sends the value, closes and hands over the result', () => {
    const answer = new Subject<string>();
    const request = vi.fn(() => answer);
    const { visible, form, done, submit } = setup(request);
    open(visible);
    form.patchValue({ name: 'Анна' });

    submit.run();
    expect(request).toHaveBeenCalledWith({ name: 'Анна' });
    expect(submit.pending()).toBe(true);
    answer.next('ok');

    expect(submit.pending()).toBe(false);
    expect(visible()).toBe(false);
    expect(done).toHaveBeenCalledWith('ok');
  });

  it('does not send an invalid form and does not send twice', () => {
    const request = vi.fn(() => new Subject<string>());
    const { visible, form, submit } = setup(request);
    open(visible);

    submit.run();
    expect(request).not.toHaveBeenCalled();
    expect(form.controls.name.touched).toBe(true);

    form.patchValue({ name: 'Анна' });
    submit.run();
    submit.run();
    expect(request).toHaveBeenCalledOnce();
  });

  it('shows the failure and stays open, the next try clears it', () => {
    const answers: Subject<string>[] = [];
    const { visible, form, done, submit } = setup(() => {
      const answer = new Subject<string>();
      answers.push(answer);
      return answer;
    });
    open(visible);
    form.patchValue({ name: 'Анна' });

    submit.run();
    answers[0]?.error(new HttpErrorResponse({ status: 500 }));
    expect(submit.error()).toContain('Не удалось');
    expect(submit.pending()).toBe(false);
    expect(visible()).toBe(true);
    expect(done).not.toHaveBeenCalled();

    submit.run();
    expect(submit.error()).toBeNull();
  });

  it('starts empty and clean every time the dialog opens', () => {
    const { visible, form, submit } = setup(() =>
      throwError(() => new HttpErrorResponse({ status: 500 })),
    );
    open(visible);
    expect(submit.dirty()).toBe(false);
    form.controls.name.markAsDirty();
    form.controls.name.setValue('Черновик');
    expect(submit.dirty()).toBe(true);
    submit.run();
    expect(submit.error()).not.toBeNull();

    visible.set(false);
    TestBed.tick();
    open(visible);

    expect(form.getRawValue()).toEqual({ name: '' });
    expect(submit.error()).toBeNull();
    expect(submit.dirty()).toBe(false);
  });

  it('fills the form by its own reset and works without a form', () => {
    TestBed.configureTestingModule({ providers: testProviders() });
    const visible = signal(false);
    const reset = vi.fn();
    const request = vi.fn(() => new Subject<string>());
    const submit = runInInjectionContext(TestBed.inject(Injector), () =>
      dialogSubmit({ visible, reset, failed: 'x', request }),
    );
    open(visible);
    expect(reset).toHaveBeenCalledOnce();

    submit.run();
    expect(request).toHaveBeenCalledWith(undefined);
    expect(submit.dirty()).toBe(false);
  });
});
