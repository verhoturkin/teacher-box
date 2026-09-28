/**
 * Parts of the meetings feature that other features embed: data access, the join button, the room
 * cell and dialog, and the settings panel. The feature has no pages of its own.
 */
export { MeetingsApi } from './data-access/meetings-api';
export type { MeetingRoom, RoomOwnerRef } from './data-access/meetings.models';
export { RoomCell } from './rooms/room-cell';
export { RoomDialog } from './rooms/room-dialog';
export { MeetingsSettingsPanel } from './settings/meetings-settings-panel';
export { JoinLessonButton } from './ui/join-lesson-button';
