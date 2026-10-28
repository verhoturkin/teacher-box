/**
 * Parts of the notifications feature that other features embed: widgets, panels, data access and its types.
 * Pages are loaded lazily through index.ts; keeping them apart keeps them out of other features' bundles.
 */
export { NotificationsApi } from './data-access/notifications-api';
export type { TeacherNotificationsSummary } from './data-access/notifications.models';
export { NotificationsSheetContent } from './sheet/notifications-sheet-content';
export { NewMessageDialog } from './teacher/new-message-dialog';
export { ChannelsPanel } from './channels/channels-panel';
export { ConnectMessengerCard } from './student/connect-messenger-card';
export { PushDevicesCard } from './push/push-devices-card';
export { PushOnboardingCard } from './push/push-onboarding-card';
export { PreferencesPanel } from './preferences/preferences-panel';
export { MessengersSettingsPanel } from './teacher/messengers-settings-panel';
export { BroadcastDialog } from './teacher/broadcast-dialog';
export { StudentChannels } from './teacher/student-channels';
