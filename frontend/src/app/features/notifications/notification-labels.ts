import {
  ChannelType,
  MessengerConnection,
  NotificationKind,
  NotificationTopic,
} from './data-access/notifications.models';
import { T } from './i18n/texts';
import { SHARED_T } from '@shared/i18n/texts';

export const CHANNEL_NAMES: Record<ChannelType, string> = SHARED_T.messengers;

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
  HOMEWORK_ASSIGNED: 'pi pi-pen-to-square',
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
  MEETING_LINK: 'pi pi-video',
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
    label: T.topics.SCHEDULE,
    hint: T.topics.SCHEDULE_HINT,
    teacherOnly: false,
  },
  {
    topic: 'REMINDERS',
    label: T.topics.REMINDERS,
    hint: T.topics.REMINDERS_HINT,
    teacherOnly: false,
  },
  {
    topic: 'HOMEWORK',
    label: T.topics.HOMEWORK,
    hint: T.topics.HOMEWORK_HINT,
    teacherOnly: false,
  },
  { topic: 'BILLING', label: T.topics.BILLING, hint: T.topics.BILLING_HINT, teacherOnly: false },
  {
    topic: 'ACCOUNT',
    label: T.topics.ACCOUNT,
    hint: T.topics.ACCOUNT_HINT,
    teacherOnly: true,
  },
];

export const CONNECTION_TAGS: Record<
  MessengerConnection,
  { readonly value: string; readonly severity: 'success' | 'info' | 'danger' }
> = {
  OK: { value: T.connections.OK, severity: 'success' },
  PENDING: { value: T.connections.PENDING, severity: 'info' },
  ERROR: { value: T.connections.ERROR, severity: 'danger' },
};
