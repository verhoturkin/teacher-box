import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ConfirmationService } from 'primeng/api';
import { buttonByText, hostElement, readableText, requireElement, typeInto } from '@testing/dom';
import { testProviders } from '@testing/setup';
import { MAX_VIDEOS, VideoDraft, VideoSection, videoDraft, videoInputs } from './video-section';

describe('VideoSection', () => {
  let fixture: ComponentFixture<VideoSection>;
  let backend: HttpTestingController;
  let confirmation: ConfirmationService;
  let answer: boolean;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [VideoSection],
      providers: testProviders(ConfirmationService),
    });
    backend = TestBed.inject(HttpTestingController);
    confirmation = TestBed.inject(ConfirmationService);
    answer = true;
    vi.spyOn(confirmation, 'confirm').mockImplementation((request) => {
      if (answer) {
        request.accept?.();
      }
      return confirmation;
    });
  });

  afterEach(() => {
    backend.verify();
  });

  async function render(videos: readonly VideoDraft[] = []) {
    fixture = TestBed.createComponent(VideoSection);
    fixture.componentRef.setInput('videos', videos);
    await fixture.whenStable();
    return { section: fixture.componentInstance, host: hostElement(fixture) };
  }

  function first(section: VideoSection): VideoDraft {
    const draft = section.videos()[0];
    if (draft === undefined) {
      throw new Error('No video');
    }
    return draft;
  }

  it('adds a video, shows its player and takes the captions from YouTube', async () => {
    const { section, host } = await render();
    expect(readableText(host)).toContain('YouTube, Rutube и VK Видео');

    buttonByText(host, 'Добавить видео').click();
    await fixture.whenStable();
    const url = requireElement(host, 'input[type="url"]', HTMLInputElement);
    expect(buttonByText(host, 'Загрузить субтитры')).toBeTruthy();
    expect(host.textContent).not.toContain('Взять субтитры с YouTube');

    typeInto(url, 'youtube.com/x');
    await fixture.whenStable();
    expect(readableText(host)).toContain('Ссылка должна начинаться с http:// или https://');
    expect(url.getAttribute('aria-invalid')).toBe('true');

    typeInto(url, 'https://youtu.be/dQw4w9WgXcQ');
    await fixture.whenStable();
    expect(host.querySelector('iframe')?.getAttribute('src')).toContain('dQw4w9WgXcQ');
    buttonByText(host, 'Взять субтитры с YouTube').click();
    const request = backend.expectOne('/api/teacher/homework/videos/transcript');
    expect(request.request.body).toEqual({ url: 'https://youtu.be/dQw4w9WgXcQ' });
    request.flush({
      title: 'Present Simple',
      language: 'en',
      automatic: true,
      transcript: '[0:05] We play',
      truncated: false,
    });
    await fixture.whenStable();

    expect(first(section)).toMatchObject({ title: 'Present Simple', transcript: '[0:05] We play' });
    expect(readableText(host)).toContain('Субтитры YouTube: en, автоматические');
    expect(confirmation.confirm).not.toHaveBeenCalled();

    // A transcript is there: replacing it is asked; «Отмена» keeps it.
    answer = false;
    buttonByText(host, 'Взять субтитры с YouTube').click();
    backend.expectNone('/api/teacher/homework/videos/transcript');
    answer = true;
    section.change(first(section).key, { title: 'Мой' });
    buttonByText(host, 'Взять субтитры с YouTube').click();
    backend.expectOne('/api/teacher/homework/videos/transcript').flush({
      title: 'Другое',
      language: 'ru',
      automatic: false,
      transcript: '[0:00] Длинно',
      truncated: true,
    });
    await fixture.whenStable();
    expect(first(section)).toMatchObject({ title: 'Мой', transcript: '[0:00] Длинно' });
    expect(readableText(host)).toContain('Субтитры YouTube: ru. Расшифровка длинная');
  });

  it('says why the captions did not come', async () => {
    const { host } = await render([{ ...videoDraft(), url: 'https://youtu.be/dQw4w9WgXcQ' }]);

    buttonByText(host, 'Взять субтитры с YouTube').click();
    backend
      .expectOne('/api/teacher/homework/videos/transcript')
      .flush(
        { status: 422, code: 'video.captions-failed' },
        { status: 422, statusText: 'Unprocessable' },
      );
    await fixture.whenStable();

    expect(readableText(host)).toContain('Не удалось получить субтитры с YouTube');
  });

  it('loads a subtitle file, edits and removes a video', async () => {
    const { section, host } = await render([videoDraft()]);
    const input = requireElement(host, 'input[type="file"]', HTMLInputElement);
    const file = new File(['1\n00:00:02,000 --> 00:00:03,000\nПривет\n'], 'урок.srt');
    Object.defineProperty(input, 'files', { value: [file], configurable: true });

    input.dispatchEvent(new Event('change'));
    await vi.waitFor(() => {
      expect(first(section).transcript).toBe('[0:02] Привет');
    });
    await fixture.whenStable();
    expect(readableText(host)).toContain('Загружено из файла урок.srt');

    Object.defineProperty(input, 'files', { value: [], configurable: true });
    input.dispatchEvent(new Event('change'));

    typeInto(
      requireElement(host, '#video-title-' + String(first(section).key), HTMLInputElement),
      'Урок',
    );
    typeInto(requireElement(host, 'textarea', HTMLTextAreaElement), '[0:02] Привет, класс');
    await fixture.whenStable();
    expect(first(section)).toMatchObject({ title: 'Урок', transcript: '[0:02] Привет, класс' });

    buttonByText(host, 'Убрать видео: Урок').click();
    await fixture.whenStable();
    expect(section.videos()).toEqual([]);
  });

  it('stops at five videos', async () => {
    const { host } = await render(Array.from({ length: MAX_VIDEOS }, () => videoDraft()));

    expect(host.textContent).not.toContain('Добавить видео');
  });

  it('saves only the videos with a link', () => {
    const saved = {
      url: 'https://youtu.be/dQw4w9WgXcQ',
      provider: 'YOUTUBE' as const,
      videoId: 'dQw4w9WgXcQ',
      startSeconds: null,
      title: 'Урок',
      transcript: '[0:00] Привет',
      transcriptShown: true,
    };
    expect(
      videoInputs([
        videoDraft(),
        { ...videoDraft(saved), url: ' https://youtu.be/dQw4w9WgXcQ ' },
        { ...videoDraft(), url: 'https://example.com/v', title: ' ', transcript: '  ' },
      ]),
    ).toEqual([
      {
        url: 'https://youtu.be/dQw4w9WgXcQ',
        title: 'Урок',
        transcript: '[0:00] Привет',
        transcriptShown: true,
      },
      { url: 'https://example.com/v', title: null, transcript: null, transcriptShown: false },
    ]);
  });
});
