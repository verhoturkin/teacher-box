import { TestBed } from '@angular/core/testing';
import { hostElement, requireElement } from '@testing/dom';
import { testProviders } from '@testing/setup';
import { PlayableVideo, VideoPlayer } from './video-player';

const VIDEO: PlayableVideo = {
  url: 'https://youtu.be/arj7oStGLkU',
  provider: 'YOUTUBE',
  videoId: 'arj7oStGLkU',
  startSeconds: null,
  name: 'Видео',
};

describe('VideoPlayer', () => {
  it('keeps its frame when the host passes an equal video again (no reload, no blink)', async () => {
    TestBed.configureTestingModule({ imports: [VideoPlayer], providers: testProviders() });
    const fixture = TestBed.createComponent(VideoPlayer);
    fixture.componentRef.setInput('video', VIDEO);
    await fixture.whenStable();
    const frame = requireElement(hostElement(fixture), 'iframe', HTMLIFrameElement);
    const loads: string[] = [];
    // every write of `src` reloads a real frame
    Object.defineProperty(frame, 'src', {
      configurable: true,
      set: (value: string) => loads.push(value),
    });

    fixture.componentRef.setInput('video', { ...VIDEO });
    await fixture.whenStable();
    expect(loads).toEqual([]);

    fixture.componentRef.setInput('video', { ...VIDEO, startSeconds: 30 });
    await fixture.whenStable();
    expect(loads).toHaveLength(1);
    fixture.destroy();
  });
});
