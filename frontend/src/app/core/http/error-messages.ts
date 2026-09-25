import { HttpErrorResponse } from '@angular/common/http';
import { isProblemDetail } from './problem-detail';

/** Localized messages for backend error codes. Unknown codes fall back to the HTTP status. */
const CODE_MESSAGES: Readonly<Record<string, string>> = {
  'auth.required': 'Требуется вход в систему',
  'access.denied': 'Недостаточно прав для этого действия',
  'validation.failed': 'Проверьте правильность заполнения полей',
  'concurrent.modification': 'Данные изменились. Обновите страницу и повторите',
  'request.invalid': 'Некорректный запрос',
  'internal.error': 'Внутренняя ошибка сервера',
  'file.not-found': 'Файл не найден',
};

const STATUS_MESSAGES: Readonly<Record<number, string>> = {
  0: 'Сервер недоступен. Проверьте подключение',
  400: 'Некорректный запрос',
  401: 'Требуется вход в систему',
  403: 'Недостаточно прав для этого действия',
  404: 'Не найдено',
  409: 'Конфликт данных',
  413: 'Слишком большой файл',
  422: 'Операция невозможна',
  429: 'Слишком много запросов. Попробуйте позже',
};

const FALLBACK = 'Произошла ошибка. Попробуйте позже';

export function messageForCode(code: string): string | undefined {
  return CODE_MESSAGES[code];
}

/** Human-readable (Russian) message for a failed HTTP call. */
export function errorMessage(error: HttpErrorResponse): string {
  const body: unknown = error.error;
  if (isProblemDetail(body) && body.code !== undefined) {
    const known = messageForCode(body.code);
    if (known !== undefined) {
      return known;
    }
  }
  return STATUS_MESSAGES[error.status] ?? FALLBACK;
}
