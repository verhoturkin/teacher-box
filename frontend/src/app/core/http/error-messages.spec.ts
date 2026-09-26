import { HttpErrorResponse } from '@angular/common/http';
import { describeError, errorMessage, messageForCode } from './error-messages';

describe('describeError', () => {
  it('uses the message of a known code or the fallback', () => {
    const known = new HttpErrorResponse({ status: 409, error: { status: 409, code: 'login.taken' } });
    const unknown = new HttpErrorResponse({ status: 409, error: { status: 409, code: 'x.y' } });

    expect(describeError(known, 'fallback')).toBe('Этот логин уже занят');
    expect(describeError(unknown, 'fallback')).toBe('fallback');
    expect(describeError(new Error('x'), 'fallback')).toBe('fallback');
  });
});

function httpError(status: number, error: unknown = null): HttpErrorResponse {
  return new HttpErrorResponse({ status, error });
}

describe('errorMessage', () => {
  it('uses the message for a known problem code', () => {
    expect(errorMessage(httpError(403, { status: 403, code: 'access.denied' }))).toBe(
      'Недостаточно прав для этого действия',
    );
  });

  it('falls back to the HTTP status for unknown codes', () => {
    expect(errorMessage(httpError(409, { status: 409, code: 'something.new' }))).toBe(
      'Конфликт данных',
    );
  });

  it('falls back to the HTTP status for problems without code and non-problem bodies', () => {
    expect(errorMessage(httpError(404, { status: 404 }))).toBe('Не найдено');
    expect(errorMessage(httpError(0, 'network down'))).toBe(
      'Сервер недоступен. Проверьте подключение',
    );
  });

  it('uses a generic message for unexpected statuses', () => {
    expect(errorMessage(httpError(503))).toBe('Произошла ошибка. Попробуйте позже');
  });

  it('exposes code lookup', () => {
    expect(messageForCode('internal.error')).toBe('Внутренняя ошибка сервера');
    expect(messageForCode('nope')).toBeUndefined();
  });
});

describe('request codes in messages', () => {
  it('adds the code to server errors so that the user can name it', () => {
    const failure = new HttpErrorResponse({
      status: 500,
      error: { status: 500, code: 'internal.error', requestId: 'k3m9x2ab7c' },
    });

    expect(errorMessage(failure)).toBe('Внутренняя ошибка сервера. Код ошибки: k3m9x2ab7c');
    expect(errorMessage(httpError(503, { status: 503, requestId: 'q1' }))).toBe(
      'Произошла ошибка. Попробуйте позже. Код ошибки: q1',
    );
    expect(describeError(failure, 'Не удалось сохранить')).toBe('Внутренняя ошибка сервера. Код ошибки: k3m9x2ab7c');
    expect(describeError(httpError(502, { status: 502, requestId: 'g1' }), 'Не удалось сохранить')).toBe(
      'Не удалось сохранить. Код ошибки: g1',
    );
  });

  it('keeps other messages short', () => {
    expect(errorMessage(httpError(404, { status: 404, requestId: 'r1' }))).toBe('Не найдено');
    expect(errorMessage(httpError(503))).toBe('Произошла ошибка. Попробуйте позже');
  });
});
