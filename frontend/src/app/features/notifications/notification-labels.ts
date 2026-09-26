import { ChannelType, NotificationKind } from './data-access/notifications.models';

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
  STUDENT_ACTIVATED: 'pi pi-user-plus',
  MESSAGE: 'pi pi-envelope',
};
