import { SourceOption } from '@features/ai/parts';
import { AssignmentDetails, BoundTextbook } from '@features/homework/data-access/homework.models';
import { T } from '@features/homework/i18n/texts';
import { videoName } from '@features/homework/ui/video-list';
import { VideoDraft } from '../video-section';

/** Files the AI reads (ADR-0039). */
const AI_READABLE = /^(application\/pdf|image\/(png|jpeg|webp|gif))$/;

/**
 * What the AI may read for a draft: the bound textbooks (not Word files) and the PDF and picture files — saved ones by
 * reference (ADR-0039), picked ones of a new assignment with the request (ADR-0042) — and the videos with a
 * transcript.
 */
export function aiSources(
  assignment: AssignmentDetails | null,
  textbooks: readonly BoundTextbook[],
  picked: readonly File[],
  videos: readonly VideoDraft[],
): SourceOption[] {
  const books = textbooks
    .filter((textbook) => textbook.format !== 'DOCUMENT')
    .map((textbook) => ({
      key: `textbook-${textbook.textbookId}`,
      label:
        textbook.pages === null
          ? textbook.title
          : `${textbook.title}, ${T.editor.pages(textbook.pages)}`,
      source: { type: 'TEXTBOOK' as const, id: textbook.textbookId, pages: textbook.pages },
    }));
  const files =
    assignment === null
      ? []
      : assignment.attachments
          .filter((file) => AI_READABLE.test(file.contentType))
          .map((file) => ({
            key: `file-${file.id}`,
            label: file.filename,
            source: { type: 'FILE' as const, id: file.id, assignmentId: assignment.id },
          }));
  const pickedFiles = picked
    .filter((file) => AI_READABLE.test(file.type))
    .map((file) => ({
      key: `picked-${file.name}-${String(file.size)}-${String(file.lastModified)}`,
      label: file.name,
      source: file,
    }));
  const transcripts = videos
    .filter((video) => video.url.trim() !== '' && video.transcript.trim() !== '')
    .map((video, index) => ({
      key: `video-${String(video.key)}`,
      label: T.videos.aiSource(videoName(video, index)),
      source: {
        type: 'VIDEO' as const,
        title: video.title.trim() === '' ? null : video.title.trim(),
        url: video.url.trim(),
        transcript: video.transcript,
      },
    }));
  return [...books, ...files, ...pickedFiles, ...transcripts];
}
