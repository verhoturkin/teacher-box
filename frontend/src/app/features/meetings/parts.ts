/**
 * Parts of the meetings feature that other features embed: the join button, the room panel, the
 * settings panel and the student's call card. The call itself is in `index.ts` (lazy).
 */
export type { RoomOwnerRef } from './data-access/meetings.models';
export { RoomPanel } from './rooms/room-panel';
export { MeetingsSettingsPanel } from './settings/meetings-settings-panel';
export { JoinLessonButton } from './ui/join-lesson-button';
export { MyCallsCard } from './home/my-calls-card';
