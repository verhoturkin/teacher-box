import { HttpErrorResponse } from '@angular/common/http';
import { errorMessage, messageForCode } from './error-messages';

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
