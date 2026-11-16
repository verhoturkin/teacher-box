import { TestBed } from '@angular/core/testing';
import { providePrimeNG } from 'primeng/config';
import { Observable, Subject } from 'rxjs';
import { buttonByText, hostElement, readableText, requireElement } from '@testing/dom';
import { VoicePlayer, formatDuration } from './voice-player';

describe('VoicePlayer', () => {
  beforeEach(() => {
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(function (
      this: HTMLMediaElement,
    ) {
      Object.defineProperty(this, 'paused', { configurable: true, value: false });
      this.dispatchEvent(new Event('play'));
      return Promise.resolve();
    });
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(function (
      this: HTMLMediaElement,
    ) {
      Object.defineProperty(this, 'paused', { configurable: true, value: true });
      this.dispatchEvent(new Event('pause'));
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function setUp(source: Blob | (() => Observable<Blob>), duration?: number) {
    TestBed.configureTestingModule({ imports: [VoicePlayer], providers: [providePrimeNG()] });
    const fixture = TestBed.createComponent(VoicePlayer);
    fixture.componentRef.setInput('source', source);
    if (duration !== undefined) {
      fixture.componentRef.setInput('duration', duration);
    }
    await fixture.whenStable();
    const host = hostElement(fixture);
    const audio = requireElement(host, 'audio', HTMLAudioElement);
    return { fixture, host, audio };
  }

  function setDuration(audio: HTMLAudioElement, value: number): void {
    Object.defineProperty(audio, 'duration', { configurable: true, value });
    audio.dispatchEvent(new Event('durationchange'));
  }

  it('formats the duration', () => {
    expect(formatDuration(7.9)).toBe('0:07');
    expect(formatDuration(760)).toBe('12:40');
  });

  it('plays a record in a hidden audio, with no native controls and no file name', async () => {
    const { fixture, host, audio } = await setUp(new File(['sound'], 'голос 09-30.webm'), 12);

    expect(audio.controls).toBe(false);
    expect(audio.getAttribute('src')).toMatch(/^blob:/);
    expect(readableText(host)).toContain('0:00 / 0:12');
    expect(readableText(host)).not.toContain('голос');

    buttonByText(host, 'Слушать').click();
    await fixture.whenStable();
    expect(buttonByText(host, 'Пауза')).toBeTruthy();
    buttonByText(host, 'Пауза').click();
    await fixture.whenStable();
    expect(buttonByText(host, 'Слушать')).toBeTruthy();

    audio.dispatchEvent(new Event('play'));
    audio.dispatchEvent(new Event('ended'));
    await fixture.whenStable();
    expect(buttonByText(host, 'Слушать')).toBeTruthy();
  });

  it('shows the position and seeks by the bar', async () => {
    const { fixture, host, audio } = await setUp(new Blob(['sound']), 12);
    Object.defineProperty(audio, 'currentTime', { configurable: true, writable: true, value: 4 });
    audio.dispatchEvent(new Event('timeupdate'));
    await fixture.whenStable();
    expect(readableText(host)).toContain('0:04 / 0:12');

    const bar = requireElement(host, 'input[type="range"]', HTMLInputElement);
    expect(bar.getAttribute('aria-label')).toBe('Место в записи');
    expect(bar.getAttribute('aria-valuetext')).toBe('0:04 / 0:12');
    bar.value = '9';
    bar.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(audio.currentTime).toBe(9);
    expect(readableText(host)).toContain('0:09 / 0:12');
  });

  it('loads a saved file, measures it and asks a webm without duration for its end once', async () => {
    const loaded = new Subject<Blob>();
    const { fixture, host, audio } = await setUp(() => loaded);
    expect(buttonByText(host, 'Слушать').hasAttribute('disabled')).toBe(true);

    loaded.next(new Blob(['sound']));
    await fixture.whenStable();
    expect(audio.getAttribute('src')).toMatch(/^blob:/);

    Object.defineProperty(audio, 'currentTime', { configurable: true, writable: true, value: 0 });
    setDuration(audio, Infinity);
    expect(audio.currentTime).toBe(Number.MAX_SAFE_INTEGER);
    audio.dispatchEvent(new Event('timeupdate'));
    setDuration(audio, Infinity);
    setDuration(audio, 15.4);
    await fixture.whenStable();

    expect(audio.currentTime).toBe(0);
    expect(readableText(host)).toContain('0:00 / 0:15');
    setDuration(audio, NaN);
    expect(readableText(host)).toContain('0:00 / 0:15');
  });

  it('drops the playing state when the browser refuses to play', async () => {
    vi.mocked(HTMLMediaElement.prototype.play).mockImplementation(() =>
      Promise.reject(new DOMException('no', 'NotAllowedError')),
    );
    const { fixture, host } = await setUp(new Blob(['sound']));
    buttonByText(host, 'Слушать').click();
    await fixture.whenStable();

    expect(buttonByText(host, 'Слушать')).toBeTruthy();
    expect(readableText(host)).toContain('0:00 / 0:00');
  });

  it('frees the record when it goes away', async () => {
    const revoke = vi.spyOn(URL, 'revokeObjectURL');
    const { fixture } = await setUp(new Blob(['sound']));
    fixture.destroy();

    expect(revoke).toHaveBeenCalledTimes(1);
  });
});
