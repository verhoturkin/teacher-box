/**
 * Parts of the meetings feature that other features embed: the join button, the room
 * panel, and the settings panel. The feature has no pages of its own.
 */
export type { RoomOwnerRef } from './data-access/meetings.models';
export { RoomPanel } from './rooms/room-panel';
export { MeetingsSettingsPanel } from './settings/meetings-settings-panel';
export { JoinLessonButton } from './ui/join-lesson-button';
