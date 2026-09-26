export type NotificationKind =
  | 'HOMEWORK_ASSIGNED'
  | 'HOMEWORK_SUBMITTED'
  | 'HOMEWORK_REVIEWED'
  | 'HOMEWORK_DUE_SOON'
  | 'LESSON_RECORDED'
  | 'LESSON_CANCELLED'
  | 'PAYMENT_RECORDED'
  | 'PAYMENT_VOIDED'
  | 'SCHEDULE_LESSON_PLANNED'
  | 'SCHEDULE_LESSON_MOVED'
  | 'SCHEDULE_LESSON_CANCELLED'
  | 'SCHEDULE_REMINDER'
  | 'SCHEDULE_REQUEST'
  | 'SCHEDULE_REQUEST_ANSWERED'
  | 'STUDENT_ACTIVATED'
  | 'MESSAGE';

export type ChannelType = 'TELEGRAM' | 'VK' | 'MAX';

/** Mirrors `NotificationView` of the backend. */
export interface NotificationItem {
  readonly id: string;
  readonly kind: NotificationKind;
  readonly title: string;
  readonly body: string | null;
  /** Route inside the portal, e.g. `/cabinet/homework/<id>`. */
  readonly link: string | null;
  readonly createdAt: string;
  readonly read: boolean;
}

export interface NotificationPage {
  readonly items: NotificationItem[];
  readonly total: number;
  readonly unread: number;
}

/** A messenger configured on the server and the user's account in it. */
export interface ChannelState {
  readonly channel: ChannelType;
  readonly linked: boolean;
  readonly displayName: string | null;
  readonly enabled: boolean;
  readonly linkedAt: string | null;
}

export interface LinkCode {
  readonly channel: ChannelType;
  /** Display form, e.g. `ABCD-2345`. */
  readonly code: string;
  readonly expiresAt: string;
  /** Opens the bot (with the code when the messenger supports it). */
  readonly url: string | null;
}

export interface BroadcastRequest {
  readonly title: string;
  readonly body: string | null;
  /** Empty: all current students. */
  readonly studentIds: string[];
}
