import { clock, embedUrl, parseVideoLink, subtitlesToTranscript } from './video-links';

describe('video links', () => {
  it.each([
    ['https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'YOUTUBE', 'dQw4w9WgXcQ', null],
    ['https://m.youtube.com/watch?v=dQw4w9WgXcQ&t=90', 'YOUTUBE', 'dQw4w9WgXcQ', 90],
    ['https://youtu.be/dQw4w9WgXcQ?t=1h2m3s', 'YOUTUBE', 'dQw4w9WgXcQ', 3723],
    ['https://youtube.com/shorts/dQw4w9WgXcQ', 'YOUTUBE', 'dQw4w9WgXcQ', null],
    ['https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?start=30', 'YOUTUBE', 'dQw4w9WgXcQ', 30],
    ['https://youtu.be/dQw4w9WgXcQ?t=abc', 'YOUTUBE', 'dQw4w9WgXcQ', null],
    ['https://youtu.be/dQw4w9WgXcQ?t=0', 'YOUTUBE', 'dQw4w9WgXcQ', null],
    [
      'https://rutube.ru/video/0123456789ABCDEF0123456789abcdef/',
      'RUTUBE',
      '0123456789abcdef0123456789abcdef',
      null,
    ],
    ['https://vk.com/video-123_456', 'VK', '-123_456', null],
    ['https://vk.com/club1?z=video-1_2%2Fpl', 'VK', '-1_2', null],
    ['https://vkvideo.ru/video_ext.php?oid=-7&id=8&hash=abc', 'VK', '-7_8', null],
    ['https://www.youtube.com/watch?v=short', 'OTHER', null, null],
    ['https://www.youtube.com/channel/abc', 'OTHER', null, null],
    ['https://rutube.ru/channel/1/', 'OTHER', null, null],
    ['https://vk.com/video_ext.php?oid=-7', 'OTHER', null, null],
    ['https://vk.com/id1', 'OTHER', null, null],
    ['http://example.com/a.mp4', 'OTHER', null, null],
  ])('reads %s', (url, provider, videoId, startSeconds) => {
    expect(parseVideoLink(` ${url} `)).toEqual({ provider, videoId, startSeconds });
  });

  it('takes only web links', () => {
    expect(parseVideoLink('youtube.com/watch?v=dQw4w9WgXcQ')).toBeNull();
    expect(parseVideoLink('ftp://example.com/v')).toBeNull();
    expect(parseVideoLink('javascript:alert(1)')).toBeNull();
  });

  it('builds the players inside the portal', () => {
    expect(embedUrl({ provider: 'YOUTUBE', videoId: 'dQw4w9WgXcQ', startSeconds: 65 })).toBe(
      'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?start=65',
    );
    expect(embedUrl({ provider: 'YOUTUBE', videoId: 'dQw4w9WgXcQ', startSeconds: null })).toBe(
      'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
    );
    expect(
      embedUrl({
        provider: 'RUTUBE',
        videoId: '0123456789abcdef0123456789abcdef',
        startSeconds: null,
      }),
    ).toBe('https://rutube.ru/play/embed/0123456789abcdef0123456789abcdef');
    expect(embedUrl({ provider: 'VK', videoId: '-7_8', startSeconds: null })).toBe(
      'https://vkvideo.ru/video_ext.php?oid=-7&id=8',
    );
    expect(embedUrl({ provider: 'OTHER', videoId: null, startSeconds: null })).toBeNull();
    expect(embedUrl({ provider: 'YOUTUBE', videoId: '"><script>', startSeconds: null })).toBeNull();
    expect(embedUrl({ provider: 'RUTUBE', videoId: 'x', startSeconds: null })).toBeNull();
    expect(embedUrl({ provider: 'VK', videoId: 'x', startSeconds: null })).toBeNull();
  });

  it('turns subtitles into a transcript of 30-second paragraphs', () => {
    const srt = [
      '1',
      '00:00:01,000 --> 00:00:03,000',
      '<i>Hello</i> class',
      '',
      '2',
      '00:00:05,500 --> 00:00:07,000',
      '{\\an8}today',
      '',
      '3',
      '00:00:40,000 --> 00:00:42,000',
      '',
      '',
      '4',
      '01:00:41,000 --> 01:00:42,000',
      'Bye',
    ].join('\r\n');
    expect(subtitlesToTranscript(srt)).toBe('[0:01] Hello class today\n[1:00:41] Bye');

    const vtt = 'WEBVTT\n\n00:12.000 --> 00:14.000\nПривет\n\n00:50.000 --> 00:51.000\nПока';
    expect(subtitlesToTranscript(vtt)).toBe('[0:12] Привет\n[0:50] Пока');
    expect(subtitlesToTranscript('  just text  ')).toBe('just text');
  });

  it('writes times', () => {
    expect(clock(5)).toBe('0:05');
    expect(clock(754)).toBe('12:34');
    expect(clock(3723)).toBe('1:02:03');
  });
});
