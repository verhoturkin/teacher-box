/**
 * Parts of the notifications feature that other features embed: widgets, data access and its types.
 * Pages are loaded lazily through index.ts; keeping them apart keeps them out of other features' bundles.
 */
export { NotificationsApi } from './data-access/notifications-api';
export type { TeacherNotificationsSummary } from './data-access/notifications.models';
export { LatestNotificationsWidget } from './home/latest-notifications-widget';
export { ConnectMessengerCard } from './student/connect-messenger-card';
