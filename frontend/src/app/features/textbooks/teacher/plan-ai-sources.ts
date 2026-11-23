import type { SourceOption } from '@features/ai/parts';
import { PickedTextbook } from '../data-access/textbooks.models';
import { T } from '../i18n/texts';
import { VideoDraft } from '../videos/video-section';
import { videoName } from '../videos/video-list';

/**
 * What the AI may read for a lesson plan: the textbooks bound to it with their pages (not Word files) and the videos
 * that have a transcript.
 */
export function planAiSources(
  textbooks: readonly PickedTextbook[],
  videos: readonly VideoDraft[],
): SourceOption[] {
  const books = textbooks
    .filter((textbook) => textbook.format !== 'DOCUMENT')
    .map((textbook) => ({
      key: `textbook-${textbook.textbookId}`,
      label:
        textbook.pages === null
          ? textbook.title
          : `${textbook.title}, ${T.planEditor.pages(textbook.pages)}`,
      source: { type: 'TEXTBOOK' as const, id: textbook.textbookId, pages: textbook.pages },
    }));
  const transcripts = videos
    .filter((video) => video.url.trim() !== '' && video.transcript.trim() !== '')
    .map((video, index) => ({
      key: `video-${String(video.key)}`,
      label: T.planEditor.aiVideo(videoName(video, index)),
      source: {
        type: 'VIDEO' as const,
        title: video.title.trim() === '' ? null : video.title.trim(),
        url: video.url.trim(),
        transcript: video.transcript,
      },
    }));
  return [...books, ...transcripts];
}
