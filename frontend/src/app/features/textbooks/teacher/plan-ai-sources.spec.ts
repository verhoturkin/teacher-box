import { planAiSources } from './plan-ai-sources';
import { videoDraft } from '../videos/video-section';

describe('planAiSources', () => {
  it('offers the textbooks that are not Word files and the videos with a transcript', () => {
    const book = (textbookId: string, format: 'PDF' | 'DOCUMENT', pages: string | null) => ({
      textbookId,
      kind: 'TEXTBOOK' as const,
      title: `Книга ${textbookId}`,
      courseName: null,
      format,
      pageCount: 10,
      pages,
    });
    const sources = planAiSources(
      [book('a', 'PDF', '3-4'), book('b', 'PDF', null), book('c', 'DOCUMENT', null)],
      [
        videoDraft({ url: 'https://youtu.be/x', title: 'Урок', transcript: '[0:01] hi' }),
        videoDraft({ url: 'https://youtu.be/y', transcript: null }),
        videoDraft({ url: 'https://youtu.be/z', transcript: '[0:02] yo' }),
      ],
    );
    expect(sources.map((source) => source.label)).toEqual([
      'Книга a, с. 3-4',
      'Книга b',
      'Видео: Урок',
      expect.stringContaining('Видео: '),
    ]);
    expect(sources[0]?.source).toEqual({ type: 'TEXTBOOK', id: 'a', pages: '3-4' });
    expect(sources[2]?.source).toMatchObject({
      type: 'VIDEO',
      title: 'Урок',
      url: 'https://youtu.be/x',
    });
    expect(sources[3]?.source).toMatchObject({ type: 'VIDEO', title: null });
  });
});
