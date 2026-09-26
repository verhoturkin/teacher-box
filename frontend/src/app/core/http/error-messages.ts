import { HttpErrorResponse } from '@angular/common/http';
import { isProblemDetail, problemCode } from './problem-detail';

/** Localized messages for backend error codes. Unknown codes fall back to the HTTP status. */
const CODE_MESSAGES: Readonly<Record<string, string>> = {
  'auth.required': 'Требуется вход в систему',
  'access.denied': 'Недостаточно прав для этого действия',
  'validation.failed': 'Проверьте правильность заполнения полей',
  'concurrent.modification': 'Данные изменились. Обновите страницу и повторите',
  'request.invalid': 'Некорректный запрос',
  'internal.error': 'Внутренняя ошибка сервера',
  'file.not-found': 'Файл не найден',
  // identity
  'auth.invalid-credentials': 'Неверный логин или пароль',
  'auth.locked': 'Слишком много неудачных попыток. Попробуйте через 15 минут',
  'auth.deactivated': 'Доступ отключён учителем',
  'auth.refresh-invalid': 'Сессия истекла. Войдите снова',
  'invite.invalid': 'Ссылка-приглашение недействительна или устарела. Попросите учителя прислать новую',
  'login.taken': 'Этот логин уже занят',
  'login.invalid': 'Логин: 3–50 символов — латинские буквы, цифры, точка, дефис, подчёркивание',
  'login.required': 'Укажите логин',
  'password.weak': 'Пароль должен быть не короче 8 символов',
  'password.wrong-current': 'Текущий пароль указан неверно',
  'profile.name-invalid': 'Имя должно содержать от 1 до 100 символов',
  'profile.email-invalid': 'Некорректный адрес электронной почты',
  'profile.phone-invalid': 'Слишком длинный номер телефона',
  'profile.note-invalid': 'Слишком длинная заметка',
  'student.not-found': 'Ученик не найден',
  'account.deactivated': 'Сначала верните ученику доступ',
  'account.already-deactivated': 'Доступ ученика уже отключён',
  'account.not-deactivated': 'Доступ ученика не был отключён',
  // billing
  'lesson.not-found': 'Занятие не найдено',
  'lesson.already-cancelled': 'Занятие уже отменено',
  'lesson.duration-invalid': 'Длительность занятия — от 1 до 600 минут',
  'lesson.price-invalid': 'Стоимость не может быть отрицательной',
  'payment.not-found': 'Оплата не найдена',
  'payment.already-voided': 'Оплата уже аннулирована',
  'payment.amount-invalid': 'Сумма оплаты должна быть больше нуля',
  'account.price-invalid': 'Цена занятия не может быть отрицательной',
  // homework
  'assignment.not-found': 'Задание не найдено',
  'assignment.title-invalid': 'Название задания — от 1 до 200 символов',
  'student.deactivated': 'Нельзя выдать задание ученику с отключённым доступом',
  'task.not-found': 'Задание не найдено',
  'task.already-accepted': 'Работа уже принята учителем',
  'task.not-submitted': 'Работа ещё не сдана',
  'submission.empty': 'Напишите ответ или прикрепите файл',
  'file.type-not-allowed': 'Такой тип файла загружать нельзя',
  'file.too-large': 'Файл слишком большой',
  'file.too-many': 'Слишком много файлов за один раз',
  'file.name-invalid': 'Некорректное имя файла',
  // notifications
  'notification.not-found': 'Уведомление не найдено',
  'notification.title-invalid': 'Тема сообщения — от 1 до 300 символов',
  'notification.body-invalid': 'Слишком длинный текст сообщения',
  'notification.no-recipients': 'Нет учеников, которым можно отправить сообщение',
  'notifications.channel-unavailable': 'Этот мессенджер не настроен на сервере',
  'notifications.channel-not-linked': 'Мессенджер не подключён',
  // platform
  'backup.not-found': 'Резервная копия не найдена',
  'auth.rate-limited': 'Слишком много попыток входа. Подождите минуту и попробуйте снова',
  // ai
  'ai.disabled': 'ИИ-помощник не настроен на сервере',
  'ai.limit-exceeded': 'Исчерпан месячный лимит токенов ИИ',
  'ai.refused': 'Модель отказалась выполнять этот запрос. Попробуйте переформулировать',
  'ai.truncated': 'Ответ модели оказался слишком длинным. Попробуйте упростить запрос',
  'ai.invalid-answer': 'Модель вернула ответ в неверном формате. Попробуйте ещё раз',
  'ai.unavailable': 'Сервис ИИ сейчас недоступен. Попробуйте позже',
  // schedule
  'schedule.student-not-found': 'Ученик не найден или отключён',
  'schedule.lesson-not-found': 'Занятие не найдено',
  'schedule.series-not-found': 'Регулярное расписание не найдено',
  'schedule.request-not-found': 'Запрос не найден',
  'schedule.overlap': 'Время пересекается с другим занятием',
  'schedule.duration-invalid': 'Длительность занятия — от 1 до 600 минут',
  'schedule.text-too-long': 'Слишком длинный текст (не больше 500 символов)',
  'schedule.meeting-url-invalid': 'Ссылка на урок должна начинаться с http:// или https://',
  'schedule.lesson-not-scheduled': 'Занятие уже проведено или отменено',
  'schedule.lesson-cancelled': 'Занятие отменено',
  'schedule.lesson-not-started': 'Занятие ещё не началось',
  'schedule.lesson-not-completed': 'У занятия нет отметки',
  'schedule.outcome-invalid': 'Выберите «Проведено» или «Пропуск»',
  'schedule.outcome-unchanged': 'Эта отметка уже стоит',
  'schedule.charge-invalid': 'Засчитать как пропуск можно только отмену по просьбе ученика',
  'schedule.weekdays-empty': 'Выберите хотя бы один день недели',
  'schedule.interval-invalid': 'Повтор — раз в 1–4 недели',
  'schedule.series-dates-invalid': 'Дата окончания раньше даты начала',
  'schedule.series-student-fixed': 'Расписание нельзя передать другому ученику',
  'schedule.range-invalid': 'Слишком большой период',
  'schedule.request-not-allowed': 'Перенести или отменить можно только предстоящее занятие',
  'schedule.proposed-time-invalid': 'Укажите новое время в будущем',
  'schedule.request-pending': 'По этому занятию уже есть запрос, дождитесь ответа учителя',
  'schedule.request-resolved': 'На запрос уже ответили',
  'schedule.students-only': 'Раздел доступен только ученикам',
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

/** Message for the backend error code of `error`, or `fallback` when the code is unknown. */
export function describeError(error: unknown, fallback: string): string {
  const code = problemCode(error);
  return (code === null ? undefined : messageForCode(code)) ?? fallback;
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
