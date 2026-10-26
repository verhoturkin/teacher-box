import { countOf, plural } from '@shared/text/plural';

function characters(count: number): string {
  return plural(count, 'символ', 'символа', 'символов');
}

/** Words every part of the portal uses, and the texts of `shared/` (ADR-0035). */
export const ru = {
  common: {
    cancel: 'Отмена',
    close: 'Закрыть',
    save: 'Сохранить',
    delete: 'Удалить',
    edit: 'Изменить',
    retry: 'Повторить',
    add: 'Добавить',
    create: 'Создать',
    back: 'Назад',
    clearSearch: 'Очистить поиск',
    next: 'Далее',
    done: 'Готово',
    send: 'Отправить',
    open: 'Открыть',
    copy: 'Копировать',
    copied: 'Скопировано',
    yes: 'Да',
    no: 'Нет',
    loading: 'Загрузка…',
    actions: 'Действия',
    student: 'Ученик',
    group: 'Группа',
    date: 'Дата',
    status: 'Статус',
    comment: 'Комментарий',
    title: 'Название',
    noTitle: 'Без названия',
    unknownStudent: 'Ученик',
    minutes: (count: number) => `${String(count)}\u00A0мин`,
    lessons: (count: number) => countOf(count, 'занятие', 'занятия', 'занятий'),
    students: (count: number) => countOf(count, 'ученик', 'ученика', 'учеников'),
  },
  dialog: {
    discardTitle: 'Отменить изменения?',
    discardText: 'Введённые данные не сохранятся.',
    discard: 'Не сохранять',
  },
  fields: {
    required: 'Заполните поле',
    email: 'Неверный адрес e-mail',
    minLength: (length: number) => `Не короче ${String(length)} ${characters(length)}`,
    maxLength: (length: number) => `Не длиннее ${String(length)} ${characters(length)}`,
    min: (value: number) => `Не меньше ${String(value)}`,
    max: (value: number) => `Не больше ${String(value)}`,
    pattern: 'Неверный формат',
    checkValue: 'Проверьте значение',
  },
  load: {
    loading: 'Загрузка',
    failed: (what: string) => `Не удалось загрузить ${what}`,
    data: 'данные',
    unknownError: 'Что-то пошло не так. Попробуйте ещё раз или чуть позже',
  },
  password: {
    show: 'Показать пароль',
    hide: 'Скрыть пароль',
  },
  messengers: {
    TELEGRAM: 'Telegram',
    VK: 'ВКонтакте',
    MAX: 'MAX',
  },
  fileSize: {
    bytes: 'Б',
    units: ['КБ', 'МБ', 'ГБ'],
  },
};
