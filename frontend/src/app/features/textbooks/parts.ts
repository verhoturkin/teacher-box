/**
 * Parts of the textbooks feature that other features embed: the API, types and labels for homework.
 * Pages are in index.ts.
 */
export { TextbooksApi, textbookPageUrl } from './data-access/textbooks-api';
export { MAX_BOARD_PAGES, parsePages } from './page-ranges';
export type {
  MyTextbook,
  Textbook,
  TextbookFormat,
  TextbookKind,
} from './data-access/textbooks.models';
export { TEXTBOOK_KIND_ICONS, TEXTBOOK_KIND_LABELS } from './textbooks-labels';
export { TextbooksFeed, type TextbooksFilter } from './teacher/textbooks-feed';
export { MyTextbooksFeed } from './student/my-textbooks-feed';
export { TextbookToBoardDialog } from './teacher/textbook-to-board-dialog';
export type { BoardTextbook } from './teacher/textbook-to-board-dialog';
export { VideosApi } from './data-access/videos-api';
export type {
  CaptionTrack,
  CaptionTracks,
  Video,
  VideoInput,
  VideoProvider,
  VideoTranscript,
} from './data-access/videos.models';
export { VideoList, videoName } from './videos/video-list';
export {
  MAX_VIDEOS,
  VideoSection,
  videoDraft,
  videoInputs,
  type VideoDraft,
} from './videos/video-section';
