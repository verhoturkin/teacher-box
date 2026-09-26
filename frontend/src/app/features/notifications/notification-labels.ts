import { ChannelType, MessengerConnection, NotificationKind, NotificationTopic } from './data-access/notifications.models';

export const CHANNEL_NAMES: Record<ChannelType, string> = {
  TELEGRAM: 'Telegram',
  VK: 'ВКонтакте',
  MAX: 'MAX',
};

export const CHANNEL_ICONS: Record<ChannelType, string> = {
  TELEGRAM: 'pi pi-telegram',
  VK: 'pi pi-comments',
  MAX: 'pi pi-comment',
};

/** Whether the bot link already carries the code (otherwise the user sends the code manually). */
export const CHANNEL_HAS_START_LINK: Record<ChannelType, boolean> = {
  TELEGRAM: true,
  VK: false,
  MAX: true,
};

export const KIND_ICONS: Record<NotificationKind, string> = {
  HOMEWORK_ASSIGNED: 'pi pi-book',
  HOMEWORK_SUBMITTED: 'pi pi-inbox',
  HOMEWORK_REVIEWED: 'pi pi-check-circle',
  HOMEWORK_DUE_SOON: 'pi pi-calendar-clock',
  LESSON_RECORDED: 'pi pi-calendar',
  LESSON_CANCELLED: 'pi pi-calendar-times',
  PAYMENT_RECORDED: 'pi pi-wallet',
  PAYMENT_VOIDED: 'pi pi-wallet',
  SCHEDULE_LESSON_PLANNED: 'pi pi-calendar-plus',
  SCHEDULE_LESSON_MOVED: 'pi pi-calendar',
  SCHEDULE_LESSON_CANCELLED: 'pi pi-calendar-times',
  SCHEDULE_REMINDER: 'pi pi-clock',
  SCHEDULE_REQUEST: 'pi pi-question-circle',
  SCHEDULE_REQUEST_ANSWERED: 'pi pi-comments',
  SCHEDULE_CALENDAR: 'pi pi-google',
  STUDENT_ACTIVATED: 'pi pi-user-plus',
  MESSAGE: 'pi pi-envelope',
};

/** Topics a user can mute in messengers, in display order (`MESSAGES` from the teacher is always sent). */
export const MUTABLE_TOPICS: readonly {
  readonly topic: NotificationTopic;
  readonly label: string;
  readonly hint: string;
  readonly teacherOnly: boolean;
}[] = [
  {
    topic: 'SCHEDULE',
    label: 'Расписание',
    hint: 'новые, перенесённые и отменённые занятия, запросы на перенос',
    teacherOnly: false,
  },
  { topic: 'REMINDERS', label: 'Напоминания', hint: 'о скором занятии и сроке сдачи задания', teacherOnly: false },
  { topic: 'HOMEWORK', label: 'Домашние задания', hint: 'выдача, сдача и проверка работ', teacherOnly: false },
  { topic: 'BILLING', label: 'Оплаты', hint: 'проведённые занятия и оплаты', teacherOnly: false },
  {
    topic: 'ACCOUNT',
    label: 'Ученики и календарь',
    hint: 'ученик принял приглашение, Google Календарь требует переподключения',
    teacherOnly: true,
  },
];

export const CONNECTION_TAGS: Record<
  MessengerConnection,
  { readonly value: string; readonly severity: 'success' | 'info' | 'danger' }
> = {
  OK: { value: 'Работает', severity: 'success' },
  PENDING: { value: 'Подключается', severity: 'info' },
  ERROR: { value: 'Нет связи', severity: 'danger' },
};
