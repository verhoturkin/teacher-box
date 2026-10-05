import { HttpErrorResponse } from '@angular/common/http';
import { isProblemDetail, problemCode, requestCode } from './problem-detail';

/** Localized messages for backend error codes. Unknown codes fall back to the HTTP status. */
const CODE_MESSAGES: Readonly<Record<string, string>> = {
  'auth.required': 'Требуется вход в систему',
  'access.denied': 'Недостаточно прав для этого действия',
  'validation.failed': 'Проверьте правильность заполнения полей',
  'concurrent.modification': 'Данные изменились. Обновите страницу и повторите',
  'request.invalid': 'Не удалось выполнить запрос. Проверьте, что всё заполнено верно',
  'internal.error': 'Ошибка на сервере. Попробуйте позже',
  'file.not-found': 'Файл не найден',
  // identity
  'auth.invalid-credentials': 'Неверный логин или пароль',
  'auth.locked': 'Слишком много неудачных попыток. Попробуйте через 15 минут',
  'auth.deactivated': 'Доступ отключён учителем',
  'auth.refresh-invalid': 'Сессия истекла. Войдите снова',
  'invite.invalid':
    'Ссылка-приглашение недействительна или устарела. Попросите учителя прислать новую',
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
  'group.not-found': 'Группа не найдена',
  'group.name-invalid': 'Название группы должно содержать от 1 до 100 символов',
  'group.member-invalid': 'В группу можно добавить только учеников с доступом к порталу',
  'group.too-many-members': 'В группе может быть не больше 100 учеников',
  'group.archived': 'Группа уже в архиве',
  'group.not-archived': 'Группа не в архиве',
  'account.already-deactivated': 'Доступ ученика уже отключён',
  'account.not-deactivated': 'Доступ ученика не был отключён',
  'account.not-active': 'Доступ ученика не активирован: он ещё не принял приглашение или отключён',
  'account.not-invited': 'Ссылка-приглашение уже использована',
  'account.not-student': 'Это действие доступно только ученикам',
  'account.not-administrator': 'Это действие доступно только администратору',
  'user.not-found': 'Пользователь не найден',
  'billing.students-only': 'История оплат есть только у учеников',
  'boards.students-only': 'Доски в личном кабинете есть только у учеников',
  'homework.students-only': 'Задания в личном кабинете есть только у учеников',
  'meetings.students-only': 'Видеовстречи в личном кабинете есть только у учеников',
  // billing
  'lesson.not-found': 'Занятие не найдено',
  'lesson.already-cancelled': 'Занятие уже отменено',
  'lesson.duration-invalid': 'Длительность занятия — от 1 до 600 минут',
  'lesson.price-invalid': 'Стоимость не может быть отрицательной',
  'payment.not-found': 'Оплата не найдена',
  'payment.already-voided': 'Оплата уже аннулирована',
  'payment.amount-invalid': 'Сумма оплаты должна быть больше нуля',
  'payment.comment-invalid': 'Комментарий к оплате слишком длинный',
  'payment.reason-invalid': 'Причина аннулирования слишком длинная',
  'lesson.reason-invalid': 'Причина отмены слишком длинная',
  'lesson.status-invalid': 'Занятие можно записать только проведённым или пропущенным',
  'lesson.topic-invalid': 'Тема занятия слишком длинная',
  'account.price-invalid': 'Цена занятия не может быть отрицательной',
  // homework
  'assignment.not-found': 'Задание не найдено',
  'assignment.title-invalid': 'Название задания — от 1 до 200 символов',
  'assignment.description-invalid': 'Текст задания слишком длинный',
  'task.grade-invalid': 'Оценка слишком длинная — не больше 20 символов',
  'task.comment-invalid': 'Комментарий к работе слишком длинный',
  'submission.text-invalid': 'Текст ответа слишком длинный',
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
  'notifications.channel-from-environment':
    'Этот бот задан администратором портала — чтобы изменить его, попросите администратора',
  'notifications.channel-check-failed':
    'Мессенджер не принял токен. Проверьте его и попробуйте снова',
  'notifications.test-failed': 'Не удалось отправить тестовое сообщение',
  'notification.quiet-hours-invalid': 'Укажите начало и конец тихих часов, они не должны совпадать',
  // platform
  'backup.not-found': 'Резервная копия не найдена',
  'backup.damaged': 'Копия повреждена: её нельзя восстановить',
  'backup.newer-version': 'Копия сделана более новой версией портала. Сначала обновите портал',
  'portal.logo-invalid': 'Логотип должен быть картинкой PNG, JPEG, WebP или SVG',
  'portal.logo-too-large': 'Логотип больше 1 МБ',
  'portal.accent-invalid': 'Такого цвета нет',
  'portal.address-invalid': 'Нужен адрес вида https://school.example.com — без пути после адреса',
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
  'schedule.series-student-fixed': 'Расписание нельзя передать другому ученику или группе',
  'schedule.group-not-found': 'Группа не найдена или в архиве',
  'schedule.group-empty': 'В группе пока нет учеников',
  'schedule.slot-busy': 'В это время учитель занят — выберите другое время',
  'schedule.lesson-charged':
    'Проведённое или засчитанное занятие удалить нельзя — сначала снимите отметку',
  'schedule.lesson-not-cancelled': 'Восстановить можно только отменённое занятие',
  'schedule.owner-invalid': 'Выберите ученика или группу',
  'schedule.attendance-required': 'Отметьте посещаемость каждого ученика группы',
  'schedule.attendance-invalid': 'Отметьте каждого ученика занятия',
  'schedule.attendance-empty': 'Никто не пришёл — отмените занятие',
  'schedule.participant-not-expected': 'Вы уже предупредили, что не придёте',
  'schedule.participant-not-found': 'Ученик не участвует в занятии',
  'schedule.lesson-group': 'Это групповое занятие',
  'schedule.lesson-not-group': 'Это занятие не групповое',
  'schedule.range-invalid': 'Слишком большой период',
  'schedule.off-time-invalid':
    'Проверьте нерабочее время: заполните все поля, конец — позже начала и не дальше чем через год',
  'schedule.off-time-not-found': 'Это нерабочее время уже удалено',
  'schedule.request-not-allowed': 'Перенести или отменить можно только предстоящее занятие',
  'schedule.proposed-time-invalid': 'Укажите новое время в будущем',
  'schedule.request-pending': 'По этому занятию уже есть запрос, дождитесь ответа учителя',
  'schedule.request-resolved': 'На запрос уже ответили',
  'schedule.students-only': 'Раздел доступен только ученикам',
  'schedule.google-client-missing': 'Сначала укажите Client ID и Client secret',
  'schedule.google-client-from-environment': 'OAuth-клиент Google задан администратором портала',
  'schedule.google-origin-invalid': 'Не удалось определить адрес портала',
  'meetings.link-invalid': 'Ссылка должна начинаться с http:// или https://',
  'meetings.not-connected':
    'Сначала подключите Яндекс в «Настройках» или вставьте ссылку на встречу сами',
  'meetings.reconnect':
    'Яндекс больше не принимает доступ портала: подключите аккаунт заново в «Настройках»',
  'meetings.telemost-failed':
    'Телемост не создал встречу. Попробуйте позже или вставьте ссылку сами',
  'meetings.room-not-found': 'Такой комнаты уже нет',
  'meetings.no-recipients':
    'Ссылку некому отправить: у ученика нет доступа или в группе никого нет',
  'meetings.client-missing': 'Сначала укажите ClientID и Client secret приложения',
  'meetings.client-from-environment': 'Приложение Яндекса задано администратором портала',
  'meetings.origin-invalid': 'Не удалось определить адрес портала',
  'meetings.student-not-found': 'Ученик не найден или отключён',
  'meetings.group-not-found': 'Группа не найдена или в архиве',
  'meetings.owner-invalid': 'Выберите ученика или группу',
  'boards.title-invalid': 'Название доски — от 1 до 200 символов',
  'boards.link-invalid': 'Ссылка должна начинаться с http:// или https://',
  'boards.student-not-found': 'Ученик не найден или отключён',
  'boards.group-not-found': 'Группа не найдена или в архиве',
  'boards.board-not-found': 'Такой доски уже нет',
  'boards.too-many-backups': 'У доски уже 20 ваших копий — удалите старые',
  'boards.backup-not-found': 'Такой копии уже нет',
  'boards.no-scene': 'У внешней доски нет рисунка в портале',
  'boards.scene-invalid': 'Рисунок доски повреждён — обновите страницу',
  'boards.scene-too-large': 'Доска слишком большая, чтобы её сохранить — удалите лишнее',
  'boards.file-type-not-allowed': 'На доску можно добавить картинки PNG, JPEG, WebP и GIF',
  'boards.file-too-large': 'Картинка больше 20 МБ',
  'boards.file-id-invalid': 'Картинку не удалось сохранить',
  'boards.file-not-found': 'Картинки уже нет',
  // administrator
  'settings.unknown': 'Такой настройки нет',
  'settings.read-only': 'Эта настройка меняется только в файле .env на сервере',
  'settings.invalid': 'Недопустимое значение настройки',
  'admin.logger-invalid': 'Некорректное имя раздела журнала',
  'admin.duration-invalid': 'Время — от 1 минуты до 24 часов',
};

const STATUS_MESSAGES: Readonly<Record<number, string>> = {
  0: 'Сервер недоступен. Проверьте подключение',
  400: 'Не удалось выполнить запрос. Проверьте, что всё заполнено верно',
  401: 'Требуется вход в систему',
  403: 'Недостаточно прав для этого действия',
  404: 'Не найдено: возможно, это уже удалили. Обновите страницу',
  409: 'Данные изменились. Обновите страницу и повторите',
  413: 'Слишком большой файл',
  422: 'Это действие сейчас недоступно. Обновите страницу и проверьте данные',
  429: 'Слишком много запросов. Попробуйте позже',
};

const FALLBACK = 'Что-то пошло не так. Попробуйте ещё раз или чуть позже';

export function messageForCode(code: string): string | undefined {
  return CODE_MESSAGES[code];
}

const SERVER_ERROR = 500;

/** Message for the backend error code of `error`, or `fallback` when the code is unknown. */
export function describeError(error: unknown, fallback: string): string {
  const code = problemCode(error);
  return withRequestCode((code === null ? undefined : messageForCode(code)) ?? fallback, error);
}

/** Human-readable (Russian) message for a failed HTTP call. */
export function errorMessage(error: HttpErrorResponse): string {
  const body: unknown = error.error;
  if (isProblemDetail(body) && body.code !== undefined) {
    const known = messageForCode(body.code);
    if (known !== undefined) {
      return withRequestCode(known, error);
    }
  }
  return withRequestCode(STATUS_MESSAGES[error.status] ?? FALLBACK, error);
}

/** Server failures get the request code: the user names it, the administrator finds it in the log. */
function withRequestCode(message: string, error: unknown): string {
  if (!(error instanceof HttpErrorResponse) || error.status < SERVER_ERROR) {
    return message;
  }
  const code = requestCode(error);
  return code === null ? message : `${message}. Код ошибки: ${code}`;
}
