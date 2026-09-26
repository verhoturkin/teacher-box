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
  | 'SCHEDULE_CALENDAR'
  | 'STUDENT_ACTIVATED'
  | 'MESSAGE';

export type ChannelType = 'TELEGRAM' | 'VK' | 'MAX';

/** Groups of notifications a user can stop receiving in messengers (`MESSAGES` is always sent). */
export type NotificationTopic = 'HOMEWORK' | 'SCHEDULE' | 'REMINDERS' | 'BILLING' | 'ACCOUNT' | 'MESSAGES';

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

/** `PENDING` until the first request to the messenger API completes. */
export type MessengerConnection = 'PENDING' | 'OK' | 'ERROR';

/** Mirrors `MessengerStatus` of the backend. */
export interface MessengerStatus {
  readonly channel: ChannelType;
  readonly connection: MessengerConnection;
  /** Why the latest request failed. */
  readonly error: string | null;
  readonly checkedAt: string | null;
}

/** A messenger bot of the instance, as the teacher sees it (mirrors `ChannelSetup`). */
export interface ChannelSetup {
  readonly channel: ChannelType;
  /** A bot is set in the environment or in the settings page. */
  readonly configured: boolean;
  /** Set by environment variables: cannot be changed in the interface. */
  readonly fromEnvironment: boolean;
  /** The bot's name, e.g. `@school_bot` (unknown for bots from the environment). */
  readonly botName: string | null;
  /** VK community id. */
  readonly groupId: number | null;
  readonly connection: MessengerStatus;
  /** The teacher connected their own account to the bot. */
  readonly teacherLinked: boolean;
}

export interface BotSettings {
  readonly token: string;
  /** Required for VK. */
  readonly groupId: number | null;
}

/** A student and the messengers they connected (mirrors `StudentChannels`). */
export interface StudentMessengers {
  readonly studentId: string;
  readonly displayName: string;
  /** Only the connected messengers. */
  readonly channels: ChannelState[];
  /** Messages not delivered in the last 30 days. */
  readonly failedDeliveries: number;
}

/** A message the teacher sent to students (mirrors `BroadcastView`). */
export interface BroadcastItem {
  readonly id: string;
  readonly title: string;
  readonly body: string | null;
  readonly recipients: number;
  readonly createdAt: string;
}

/** What the user gets in messengers (mirrors `PreferencesView`). */
export interface NotificationPreferences {
  readonly mutedTopics: NotificationTopic[];
  /** `HH:mm` or `HH:mm:ss` in the instance time zone; both ends are set or both are `null`. */
  readonly quietFrom: string | null;
  readonly quietTo: string | null;
}

/** Mirrors `TeacherNotificationsSummary`. */
export interface TeacherNotificationsSummary {
  /** Messages that could not be delivered in the last 30 days. */
  readonly failedDeliveries: number;
  /** At least one messenger bot works. */
  readonly messengerConfigured: boolean;
  readonly students: number;
  readonly studentsWithMessenger: number;
}
