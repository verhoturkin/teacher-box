import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { EMPTY, Subject, of, throwError } from 'rxjs';
import { LoadState } from './load-state';

describe('LoadState', () => {
  let state: LoadState;

  beforeEach(() => {
    state = TestBed.runInInjectionContext(() => new LoadState());
  });

  it('is loading until the first value, then ready', () => {
    const source = new Subject<number>();
    const values: number[] = [];
    source.pipe(state.track()).subscribe((value) => values.push(value));

    expect(state.status()).toBe('loading');
    expect(state.loading()).toBe(true);

    source.next(1);

    expect(state.ready()).toBe(true);
    expect(values).toEqual([1]);
  });

  it('is ready after a load without values', () => {
    EMPTY.pipe(state.track()).subscribe();

    expect(state.status()).toBe('ready');
  });

  it('keeps the content while a loaded section reloads', () => {
    of(1).pipe(state.track()).subscribe();
    const reload = new Subject<number>();
    reload.pipe(state.track()).subscribe();

    expect(state.status()).toBe('ready');
  });

  it('shows the error of a failed load with the code of the request and ends the stream', () => {
    const failure = new HttpErrorResponse({
      status: 500,
      error: { status: 500, code: 'internal.error', requestId: 'k3m9x2ab7c' },
    });
    let failed = false;
    throwError(() => failure)
      .pipe(state.track())
      .subscribe({ error: () => (failed = true) });

    expect(state.status()).toBe('error');
    expect(state.error()).toBe('Ошибка на сервере. Попробуйте позже. Код ошибки: k3m9x2ab7c');
    expect(failed).toBe(false);
  });

  it('loads again after an error: loading, then ready', () => {
    throwError(() => new Error('boom'))
      .pipe(state.track())
      .subscribe();

    expect(state.error()).toBe('Что-то пошло не так. Попробуйте ещё раз или чуть позже');

    const retry = new Subject<number>();
    retry.pipe(state.track()).subscribe();

    expect(state.status()).toBe('loading');
    expect(state.error()).toBeNull();

    retry.next(2);

    expect(state.status()).toBe('ready');
  });

  it('is done without a request', () => {
    state.fail(new Error('boom'));
    state.done();

    expect(state.status()).toBe('ready');
    expect(state.error()).toBeNull();
  });
});
