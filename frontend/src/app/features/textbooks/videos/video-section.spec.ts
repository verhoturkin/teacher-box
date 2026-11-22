import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ConfirmationService } from 'primeng/api';
import {
  buttonByText,
  hostElement,
  menuItemByText,
  readableText,
  requireElement,
  typeInto,
} from '@testing/dom';
import { screenWidth, testProviders } from '@testing/setup';
import { CaptionTrack, CaptionTracks } from '../data-access/videos.models';
import {
  MAX_VIDEOS,
  VideoDraft,
  VideoSection,
  languageName,
  transcriptLines,
  videoDraft,
  videoInputs,
} from './video-section';

const RU: CaptionTrack = { language: 'ru', automatic: false };
const EN_AUTO: CaptionTrack = { language: 'en', automatic: true };
const YOUTUBE = 'https://youtu.be/dQw4w9WgXcQ';

function tracks(list: CaptionTrack[], suggested = list[0]): CaptionTracks {
  if (suggested === undefined) {
    throw new Error('No track');
  }
  return { title: null, tracks: list, suggested };
}

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
    document.body.querySelectorAll('.p-dialog-mask, .p-menu-overlay').forEach((node) => {
      node.remove();
    });
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

  async function configure(host: HTMLElement, name: string) {
    buttonByText(host, `Настроить видео: ${name}`).click();
    await fixture.whenStable();
    return requireElement(document.body, '.p-dialog', HTMLElement);
  }

  it('adds a tile from the link field: a known player at once, another link on Enter', async () => {
    const { section, host } = await render();
    const link = requireElement(host, '#video-link', HTMLInputElement);
    expect(link.placeholder).toBe('Вставьте ссылку на видео');
    expect(readableText(host)).toContain('YouTube, Rutube и VK Видео');

    typeInto(link, 'youtube.com/x');
    link.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    await fixture.whenStable();
    expect(readableText(host)).toContain('Ссылка должна начинаться с http:// или https://');
    expect(link.getAttribute('aria-invalid')).toBe('true');

    typeInto(link, `${YOUTUBE}?t=45`);
    await fixture.whenStable();
    expect(section.videos()).toHaveLength(1);
    expect(link.value).toBe('');
    expect(host.querySelector('img')?.getAttribute('src')).toBe(
      'https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg',
    );
    expect(readableText(host)).toContain(
      'Видео 1 YouTube · с 0:45 Без расшифровки Получаю субтитры…',
    );
    // the captions are asked at once, of the suggested track; none — a quiet note under the tile
    const automatic = backend.expectOne('/api/teacher/textbooks/videos/transcript');
    expect(automatic.request.body).toEqual({ url: `${YOUTUBE}?t=45` });
    automatic.flush(
      { status: 422, code: 'video.captions-none' },
      { status: 422, statusText: 'Unprocessable' },
    );
    await fixture.whenStable();
    expect(readableText(host)).toContain('Без расшифровки У видео нет субтитров');
    expect(host.querySelector('.tb-video-note__action')).toBeNull();

    typeInto(link, 'https://example.com/lesson');
    await fixture.whenStable();
    expect(section.videos()).toHaveLength(1);
    link.dispatchEvent(new Event('blur'));
    await fixture.whenStable();
    expect(section.videos().map((video) => video.url)).toEqual([
      `${YOUTUBE}?t=45`,
      'https://example.com/lesson',
    ]);
    expect(readableText(host)).toContain('Плеера нет — ученик откроет по ссылке');

    section.commit();
    expect(section.videos()).toHaveLength(2);
  });

  it('shows the transcript tags and reorders the tiles by the arrow keys', async () => {
    const { section, host } = await render([
      {
        ...videoDraft(),
        url: YOUTUBE,
        title: 'Первое',
        transcript: '[0:00] А',
        transcriptShown: true,
      },
      { ...videoDraft(), url: 'https://rutube.ru/video/0123456789abcdef0123456789abcdef/' },
    ]);
    expect(readableText(host)).toContain('Первое YouTube Расшифровка видит ученик');
    expect(readableText(host)).toContain('Видео 2 Rutube Без расшифровки');
    expect(host.querySelectorAll('img')).toHaveLength(1);

    const handle = buttonByText(
      host,
      'Переместить «Первое»: перетащите или нажмите стрелку вверх или вниз',
    );
    handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
    expect(first(section).title).toBe('Первое');
    handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    await fixture.whenStable();
    expect(section.videos().map((video) => video.title)).toEqual(['', 'Первое']);
    expect(document.activeElement?.getAttribute('aria-label')).toContain('Первое');
  });

  it('hides the link field at five videos and shows it again when one goes', async () => {
    const { section, host } = await render(
      Array.from({ length: MAX_VIDEOS }, () => ({ ...videoDraft(), url: YOUTUBE })),
    );
    expect(host.querySelector('#video-link')).toBeNull();

    section.remove(section.videos()[0]?.key ?? 0);
    await fixture.whenStable();
    expect(section.videos()).toHaveLength(MAX_VIDEOS - 1);
    expect(host.querySelector('#video-link')).not.toBeNull();
    section.focusLink();
    expect(document.activeElement?.id).toBe('video-link');
  });

  it('takes the captions from YouTube in the side sheet and seeks the player by a time', async () => {
    const { section, host } = await render([{ ...videoDraft(), url: YOUTUBE }]);
    const sheet = await configure(host, 'Видео 1');
    expect(readableText(sheet)).toContain('Видео 1 из 1');
    expect(sheet.querySelector('iframe')?.getAttribute('src')).toContain('dQw4w9WgXcQ');

    buttonByText(sheet, 'Субтитры YouTube').click();
    const captions = backend.expectOne('/api/teacher/textbooks/videos/captions');
    expect(captions.request.body).toEqual({ url: YOUTUBE });
    captions.flush(tracks([EN_AUTO]));
    const request = backend.expectOne('/api/teacher/textbooks/videos/transcript');
    expect(request.request.body).toEqual({ url: YOUTUBE, language: 'en', automatic: true });
    request.flush({
      title: 'Present Simple',
      language: 'en',
      automatic: true,
      transcript: '[0:05] We play\nno time',
      truncated: false,
    });
    await fixture.whenStable();

    expect(first(section)).toMatchObject({
      title: 'Present Simple',
      transcript: '[0:05] We play\nno time',
    });
    expect(readableText(sheet)).toContain('Субтитры: английский, автоматические · Сменить язык');
    expect(readableText(sheet)).toContain('0:05 We play');
    expect(confirmation.confirm).not.toHaveBeenCalled();

    buttonByText(sheet, 'Смотреть с 0:05').click();
    await fixture.whenStable();
    expect(sheet.querySelector('iframe')?.getAttribute('src')).toContain('?start=5');

    // The captions as they came are replaced without asking.
    buttonByText(sheet, 'Субтитры YouTube').click();
    backend.expectOne('/api/teacher/textbooks/videos/captions').flush(tracks([EN_AUTO]));
    backend.expectOne('/api/teacher/textbooks/videos/transcript').flush({
      title: null,
      language: 'en',
      automatic: true,
      transcript: '[0:05] We',
      truncated: false,
    });
    await fixture.whenStable();
    expect(confirmation.confirm).not.toHaveBeenCalled();

    // The teacher edited them: replacing is asked; «Отмена» keeps the text.
    buttonByText(sheet, 'Править текст').click();
    await fixture.whenStable();
    typeInto(requireElement(sheet, 'textarea', HTMLTextAreaElement), '[0:05] We play, mine');
    answer = false;
    buttonByText(sheet, 'Субтитры YouTube').click();
    backend.expectOne('/api/teacher/textbooks/videos/captions').flush(tracks([EN_AUTO]));
    backend.expectNone('/api/teacher/textbooks/videos/transcript');
    expect(confirmation.confirm).toHaveBeenCalledOnce();
    expect(first(section).transcript).toBe('[0:05] We play, mine');
  });

  it('takes the captions of a new YouTube link itself and offers «Сменить язык» under the tile', async () => {
    const { section, host } = await render();
    typeInto(requireElement(host, '#video-link', HTMLInputElement), YOUTUBE);
    await fixture.whenStable();
    backend.expectOne('/api/teacher/textbooks/videos/transcript').flush({
      title: 'Present Simple',
      language: 'en',
      automatic: true,
      transcript: '[0:05] We play',
      truncated: false,
    });
    await fixture.whenStable();
    expect(first(section)).toMatchObject({
      title: 'Present Simple',
      transcript: '[0:05] We play',
      transcriptShown: false,
    });
    expect(readableText(host)).toContain(
      'Present Simple YouTube Расшифровка Субтитры: английский, автоматические · Сменить язык',
    );

    buttonByText(host, 'Сменить язык').click();
    backend
      .expectOne('/api/teacher/textbooks/videos/captions')
      .flush(tracks([RU, EN_AUTO], EN_AUTO));
    await fixture.whenStable();
    expect(readableText(document.body)).toContain('Заменит текущую расшифровку');
    menuItemByText('Русский').click();
    const chosen = backend.expectOne('/api/teacher/textbooks/videos/transcript');
    expect(chosen.request.body).toEqual({ url: YOUTUBE, language: 'ru', automatic: false });
    chosen.flush({
      title: null,
      language: 'ru',
      automatic: false,
      transcript: '[0:05] Мы играем',
      truncated: false,
    });
    await fixture.whenStable();
    expect(confirmation.confirm).not.toHaveBeenCalled();
    expect(first(section).transcript).toBe('[0:05] Мы играем');
    expect(readableText(host)).toContain('Субтитры: русский · Сменить язык');
  });

  it('never overwrites a transcript and retries a failed request quietly', async () => {
    const { section, host } = await render();
    const link = requireElement(host, '#video-link', HTMLInputElement);
    typeInto(link, YOUTUBE);
    await fixture.whenStable();
    // a transcript written while the captions were on their way stays
    section.change(first(section).key, { transcript: '[0:00] Моё' });
    backend.expectOne('/api/teacher/textbooks/videos/transcript').flush({
      title: 'Чужое',
      language: 'en',
      automatic: true,
      transcript: '[0:00] Theirs',
      truncated: false,
    });
    await fixture.whenStable();
    expect(first(section)).toMatchObject({ title: '', transcript: '[0:00] Моё' });
    section.autoTranscript(first(section).key);
    backend.expectNone('/api/teacher/textbooks/videos/transcript');

    // a failure: «Не удалось получить субтитры · Повторить», no toast
    section.remove(first(section).key);
    typeInto(link, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    await fixture.whenStable();
    backend
      .expectOne('/api/teacher/textbooks/videos/transcript')
      .flush(
        { status: 422, code: 'video.captions-failed' },
        { status: 422, statusText: 'Unprocessable' },
      );
    await fixture.whenStable();
    expect(readableText(host)).toContain('Не удалось получить субтитры · Повторить');
    buttonByText(host, 'Повторить').click();
    backend.expectOne('/api/teacher/textbooks/videos/transcript').flush({
      title: null,
      language: 'en',
      automatic: false,
      transcript: '[0:00] Hi',
      truncated: false,
    });
    await fixture.whenStable();
    expect(readableText(host)).toContain('Субтитры: английский · Сменить язык');

    // removed before the answer: nothing comes back to it; other hosts ask nothing
    typeInto(link, 'https://youtu.be/aaaaaaaaaaa');
    await fixture.whenStable();
    const late = backend.expectOne('/api/teacher/textbooks/videos/transcript');
    section.remove(section.videos()[1]?.key ?? 0);
    late.flush({ status: 500 }, { status: 500, statusText: 'Error' });
    typeInto(link, 'https://youtu.be/bbbbbbbbbbb');
    await fixture.whenStable();
    const gone = backend.expectOne('/api/teacher/textbooks/videos/transcript');
    section.remove(section.videos()[1]?.key ?? 0);
    gone.flush({ title: null, language: 'en', automatic: true, transcript: 'x', truncated: false });
    typeInto(link, 'https://rutube.ru/video/0123456789abcdef0123456789abcdef/');
    await fixture.whenStable();
    backend.expectNone('/api/teacher/textbooks/videos/transcript');
    expect(section.videos()).toHaveLength(2);
    expect(host.querySelectorAll('.tb-field__error')).toHaveLength(0);
  });

  it('offers a menu of caption tracks, the suggested one first', async () => {
    const { section, host } = await render([
      { ...videoDraft(), url: YOUTUBE, title: 'Мой', transcript: '[0:00] Был' },
    ]);
    const sheet = await configure(host, 'Мой');

    buttonByText(sheet, 'Субтитры YouTube').click();
    backend
      .expectOne('/api/teacher/textbooks/videos/captions')
      .flush(tracks([RU, EN_AUTO], EN_AUTO));
    await fixture.whenStable();

    const text = readableText(document.body);
    expect(text).toContain('Заменит текущую расшифровку');
    expect(text).toContain('Английский автоматические');
    expect(text).toContain('Русский от автора видео');
    expect(text.indexOf('Английский')).toBeLessThan(text.indexOf('Русский'));
    expect(confirmation.confirm).not.toHaveBeenCalled();

    // the transcript came with the assignment: the teacher's own, replaced after asking
    menuItemByText('Русский').click();
    await fixture.whenStable();
    expect(confirmation.confirm).toHaveBeenCalledOnce();
    const request = backend.expectOne('/api/teacher/textbooks/videos/transcript');
    expect(request.request.body).toEqual({ url: YOUTUBE, language: 'ru', automatic: false });
    request.flush({
      title: 'Другое',
      language: 'ru',
      automatic: false,
      transcript: '[0:00] Длинно',
      truncated: true,
    });
    await fixture.whenStable();
    expect(first(section)).toMatchObject({ title: 'Мой', transcript: '[0:00] Длинно' });
    expect(readableText(sheet)).toContain('Субтитры: русский. Расшифровка длинная');
  });

  it('says why the captions did not come', async () => {
    const { host } = await render([{ ...videoDraft(), url: YOUTUBE }]);
    const sheet = await configure(host, 'Видео 1');

    buttonByText(sheet, 'Субтитры YouTube').click();
    backend
      .expectOne('/api/teacher/textbooks/videos/captions')
      .flush(
        { status: 422, code: 'video.captions-failed' },
        { status: 422, statusText: 'Unprocessable' },
      );
    await fixture.whenStable();
    expect(readableText(sheet)).toContain('Не удалось получить субтитры с YouTube');

    buttonByText(sheet, 'Субтитры YouTube').click();
    backend.expectOne('/api/teacher/textbooks/videos/captions').flush(tracks([RU]));
    backend
      .expectOne('/api/teacher/textbooks/videos/transcript')
      .flush(
        { status: 422, code: 'video.captions-none' },
        { status: 422, statusText: 'Unprocessable' },
      );
    await fixture.whenStable();
    expect(readableText(sheet)).toContain('У этого видео нет субтитров');

    // typing into the empty transcript keeps the text area
    typeInto(requireElement(sheet, 'textarea', HTMLTextAreaElement), '[0:01] Сам');
    await fixture.whenStable();
    expect(sheet.querySelector('textarea')).not.toBeNull();
  });

  it('loads a file, edits the text, steps between videos and removes one', async () => {
    const { section, host } = await render([
      { ...videoDraft(), url: 'https://vkvideo.ru/video-1_2' },
      { ...videoDraft(), url: 'https://example.com/v', title: 'Второе' },
    ]);
    const sheet = await configure(host, 'Видео 1');
    expect(sheet.textContent).not.toContain('Субтитры YouTube');
    const input = requireElement(sheet, 'input[type="file"]', HTMLInputElement);
    const file = new File(['1\n00:00:02,000 --> 00:00:03,000\nПривет\n'], 'урок.srt');
    Object.defineProperty(input, 'files', { value: [file], configurable: true });

    input.dispatchEvent(new Event('change'));
    await vi.waitFor(() => {
      expect(first(section).transcript).toBe('[0:02] Привет');
    });
    await fixture.whenStable();
    expect(readableText(sheet)).toContain('Загружено из файла урок.srt');
    // VK starts no time: the times are text
    expect(sheet.querySelector('button.tb-video-sheet__time')).toBeNull();

    Object.defineProperty(input, 'files', { value: [], configurable: true });
    input.dispatchEvent(new Event('change'));

    typeInto(requireElement(sheet, '#video-title', HTMLInputElement), 'Урок');
    buttonByText(sheet, 'Править текст').click();
    await fixture.whenStable();
    typeInto(requireElement(sheet, 'textarea', HTMLTextAreaElement), '[0:02] Привет, класс');
    requireElement(sheet, '#video-shown', HTMLInputElement).click();
    await fixture.whenStable();
    expect(first(section)).toMatchObject({
      title: 'Урок',
      transcript: '[0:02] Привет, класс',
      transcriptShown: true,
    });

    expect(buttonByText(sheet, 'Предыдущее видео').disabled).toBe(true);
    buttonByText(sheet, 'Следующее видео').click();
    await fixture.whenStable();
    expect(readableText(sheet)).toContain('Видео 2 из 2');
    expect(buttonByText(sheet, 'Следующее видео').disabled).toBe(true);
    buttonByText(sheet, 'Предыдущее видео').click();
    await fixture.whenStable();
    expect(readableText(sheet)).toContain('Видео 1 из 2');

    buttonByText(sheet, 'Убрать видео').click();
    await fixture.whenStable();
    expect(section.videos().map((video) => video.title)).toEqual(['Второе']);
    expect(section.openKey()).toBeNull();
  });

  it('is a dialog over the editor: ‹ › in the headline, «Готово» and Esc only close it', async () => {
    const { section, host } = await render([
      videoDraft({ url: YOUTUBE }),
      videoDraft({ url: YOUTUBE }),
    ]);
    const dialog = await configure(host, 'Видео 1');
    const head = requireElement(dialog, '.tb-d__head', HTMLElement);

    expect(dialog.getAttribute('role')).toBe('dialog');
    expect(readableText(head)).toContain('Видео 1 из 2');
    expect(head.querySelector('[aria-label="Следующее видео"]')).not.toBeNull();
    typeInto(requireElement(dialog, '#video-title', HTMLInputElement), 'Урок');
    expect(first(section).title).toBe('Урок');

    buttonByText(dialog, 'Готово').click();
    await fixture.whenStable();
    expect(section.openKey()).toBeNull();
    expect(first(section).title).toBe('Урок');

    const again = await configure(host, 'Урок');
    again.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await fixture.whenStable();
    expect(section.openKey()).toBeNull();
  });

  it('is full screen on a phone: «Готово» in the header, ‹ › beside «Убрать видео»', async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [VideoSection],
      providers: testProviders(ConfirmationService, screenWidth(390)),
    });
    backend = TestBed.inject(HttpTestingController);
    const { section, host } = await render([
      videoDraft({ url: YOUTUBE }),
      videoDraft({ url: YOUTUBE }),
    ]);
    const dialog = await configure(host, 'Видео 1');

    expect(dialog.classList.contains('tb-d--full')).toBe(true);
    const head = requireElement(dialog, '.tb-d__head', HTMLElement);
    expect(head.querySelector('[aria-label="Следующее видео"]')).toBeNull();
    const footer = requireElement(dialog, '.tb-video-sheet__footer', HTMLElement);
    expect(readableText(footer)).toBe('Убрать видео');
    expect(footer.querySelector('[aria-label="Следующее видео"]')).not.toBeNull();
    buttonByText(head, 'Готово').click();
    await fixture.whenStable();
    expect(section.openKey()).toBeNull();
  });

  it('reads the times of a transcript and names the languages', () => {
    expect(transcriptLines('[1:05] Один\n\n[1:02:03] Два\nТри')).toEqual([
      { seconds: 65, text: 'Один' },
      { seconds: 3723, text: 'Два' },
      { seconds: null, text: 'Три' },
    ]);
    expect(languageName('en')).toBe('английский');
    expect(languageName('!!')).toBe('!!');
  });

  it('saves only the videos with a link', () => {
    const saved = {
      url: YOUTUBE,
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
        { ...videoDraft(saved), url: ` ${YOUTUBE} ` },
        { ...videoDraft(), url: 'https://example.com/v', title: ' ', transcript: '  ' },
      ]),
    ).toEqual([
      { url: YOUTUBE, title: 'Урок', transcript: '[0:00] Привет', transcriptShown: true },
      { url: 'https://example.com/v', title: null, transcript: null, transcriptShown: false },
    ]);
  });
});
