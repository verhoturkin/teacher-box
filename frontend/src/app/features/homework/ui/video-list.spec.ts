import { TestBed } from '@angular/core/testing';
import { providePrimeNG } from 'primeng/config';
import { buttonByText, hostElement, readableText } from '@testing/dom';
import { Video } from '../data-access/homework.models';
import { VideoList, videoName } from './video-list';
import { VideoPlayer } from './video-player';

function video(overrides: Partial<Video> = {}): Video {
  return {
    url: 'https://youtu.be/dQw4w9WgXcQ',
    provider: 'YOUTUBE',
    videoId: 'dQw4w9WgXcQ',
    startSeconds: null,
    title: 'Present Simple',
    transcript: '[0:05] We play',
    transcriptShown: true,
    ...overrides,
  };
}

describe('VideoPlayer', () => {
  it('plays a known platform in a frame and opens any other link in a tab', async () => {
    TestBed.configureTestingModule({ imports: [VideoPlayer] });
    const fixture = TestBed.createComponent(VideoPlayer);
    fixture.componentRef.setInput('video', { ...video(), name: 'Present Simple' });
    await fixture.whenStable();
    const host = hostElement(fixture);

    const frame = host.querySelector('iframe');
    expect(frame?.getAttribute('src')).toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
    expect(frame?.title).toBe('Видео: Present Simple');

    fixture.componentRef.setInput('video', {
      url: 'https://example.com/v.mp4',
      provider: 'OTHER',
      videoId: null,
      startSeconds: null,
      name: 'Видео 1',
    });
    await fixture.whenStable();
    const link = host.querySelector('a');
    expect(host.querySelector('iframe')).toBeNull();
    expect(link?.getAttribute('href')).toBe('https://example.com/v.mp4');
    expect(link?.target).toBe('_blank');
    expect(link?.rel).toBe('noopener noreferrer');
    expect(readableText(host)).toContain('Открыть видео в новой вкладке');
  });
});

describe('VideoList', () => {
  it('shows each video with its transcript under a toggle', async () => {
    TestBed.configureTestingModule({ imports: [VideoList], providers: [providePrimeNG()] });
    const fixture = TestBed.createComponent(VideoList);
    fixture.componentRef.setInput('videos', [
      video(),
      video({ title: null, transcript: null, url: 'https://example.com/v', provider: 'OTHER' }),
    ]);
    await fixture.whenStable();
    const host = hostElement(fixture);

    expect(readableText(host)).toContain('Present Simple');
    expect(readableText(host)).toContain('Видео 2');
    expect(readableText(host)).not.toContain('[0:05] We play');
    expect(readableText(host)).not.toContain('ученик видит расшифровку');

    buttonByText(host, 'Расшифровка').click();
    await fixture.whenStable();
    expect(readableText(host)).toContain('[0:05] We play');
    buttonByText(host, 'Скрыть расшифровку').click();
    await fixture.whenStable();
    expect(readableText(host)).not.toContain('[0:05] We play');

    fixture.componentRef.setInput('teacher', true);
    await fixture.whenStable();
    expect(readableText(host)).toContain('ученик видит расшифровку');
  });

  it('renders nothing without videos and names untitled ones', async () => {
    TestBed.configureTestingModule({ imports: [VideoList] });
    const fixture = TestBed.createComponent(VideoList);
    fixture.componentRef.setInput('videos', []);
    await fixture.whenStable();

    expect(hostElement(fixture).querySelector('ul')).toBeNull();
    expect(videoName({ title: '  ' }, 0)).toBe('Видео 1');
    expect(videoName({ title: ' Урок ' }, 0)).toBe('Урок');
  });
});
