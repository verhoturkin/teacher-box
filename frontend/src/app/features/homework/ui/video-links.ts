import { VideoProvider } from '../data-access/homework.models';

/** What a link plays (ADR-0047); mirrors `VideoLink.parse` of the backend. */
export interface ParsedVideo {
  readonly provider: VideoProvider;
  /** The video on its platform; `null` for a plain link. */
  readonly videoId: string | null;
  readonly startSeconds: number | null;
}

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
const YOUTUBE_PATH = /^\/(?:shorts|embed|live|v)\/([A-Za-z0-9_-]{11})/;
const RUTUBE_PATH = /^\/(?:video|play\/embed|shorts)\/([0-9a-f]{32})/i;
const VK_VIDEO = /video(-?\d+_\d+)/;
const VK_ID = /^(-?\d+)_(\d+)$/;
const TIME = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?$/;

/** The player of an http(s) link; `null` — not a web link. */
export function parseVideoLink(text: string): ParsedVideo | null {
  let url: URL;
  try {
    url = new URL(text.trim());
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return null;
  }
  const host = url.hostname.toLowerCase().replace(/^(www\.|m\.)/, '');
  const other: ParsedVideo = { provider: 'OTHER', videoId: null, startSeconds: null };
  switch (host) {
    case 'youtube.com':
    case 'youtube-nocookie.com':
    case 'music.youtube.com':
    case 'youtu.be':
      return youtube(url, host === 'youtu.be') ?? other;
    case 'rutube.ru': {
      const id = RUTUBE_PATH.exec(url.pathname)?.[1];
      return id === undefined
        ? other
        : { provider: 'RUTUBE', videoId: id.toLowerCase(), startSeconds: null };
    }
    case 'vk.com':
    case 'vk.ru':
    case 'vkvideo.ru':
      return vk(url) ?? other;
    default:
      return other;
  }
}

function youtube(url: URL, short: boolean): ParsedVideo | null {
  let id: string | undefined;
  if (short) {
    id = url.pathname.slice(1);
  } else if (url.pathname === '/watch') {
    id = url.searchParams.get('v') ?? undefined;
  } else {
    id = YOUTUBE_PATH.exec(url.pathname)?.[1];
  }
  if (id === undefined || !YOUTUBE_ID.test(id)) {
    return null;
  }
  return {
    provider: 'YOUTUBE',
    videoId: id,
    startSeconds: seconds(url.searchParams.get('t') ?? url.searchParams.get('start')),
  };
}

function vk(url: URL): ParsedVideo | null {
  if (url.pathname.startsWith('/video_ext.php')) {
    const oid = url.searchParams.get('oid');
    const id = url.searchParams.get('id');
    return oid !== null && /^-?\d+$/.test(oid) && id !== null && /^\d+$/.test(id)
      ? { provider: 'VK', videoId: `${oid}_${id}`, startSeconds: null }
      : null;
  }
  const id = VK_VIDEO.exec(`${url.pathname}?${decodeURIComponent(url.search)}`)?.[1];
  return id === undefined ? null : { provider: 'VK', videoId: id, startSeconds: null };
}

/** `90`, `90s`, `1m30s`, `1h2m3s`; anything else — from the beginning. */
function seconds(time: string | null): number | null {
  const match = time === null || time === '' ? null : TIME.exec(time);
  if (match === null) {
    return null;
  }
  const total = Number(match[1] ?? 0) * 3600 + Number(match[2] ?? 0) * 60 + Number(match[3] ?? 0);
  return total > 0 ? total : null;
}

/** The address of the player inside the portal; `null` — a plain link (CSP `frame-src` allows only these). */
export function embedUrl(video: {
  readonly provider: VideoProvider;
  readonly videoId: string | null;
  readonly startSeconds: number | null;
}): string | null {
  const id = video.videoId;
  if (id === null) {
    return null;
  }
  switch (video.provider) {
    case 'YOUTUBE':
      return YOUTUBE_ID.test(id)
        ? `https://www.youtube-nocookie.com/embed/${id}${video.startSeconds === null ? '' : `?start=${String(video.startSeconds)}`}`
        : null;
    case 'RUTUBE':
      return /^[0-9a-f]{32}$/.test(id) ? `https://rutube.ru/play/embed/${id}` : null;
    case 'VK': {
      const parts = VK_ID.exec(id);
      return parts === null
        ? null
        : `https://vkvideo.ru/video_ext.php?oid=${parts[1] ?? ''}&id=${parts[2] ?? ''}`;
    }
    case 'OTHER':
      return null;
  }
}

/** A new paragraph of a transcript starts this long after the previous one (as the backend's captions). */
const PARAGRAPH_SECONDS = 30;
const CUE_TIME = /(?:(\d+):)?(\d{1,2}):(\d{2})[.,]\d{1,3}\s*-->/;

/**
 * An .srt or .vtt file as a transcript: paragraphs of about 30 seconds, `[m:ss] text`; tags (`<i>`, `{\an8}`) and
 * cue numbers dropped. Any other text is taken as it is.
 */
export function subtitlesToTranscript(file: string): string {
  const blocks = file.replace(/\r/g, '').split(/\n{2,}/);
  const paragraphs: string[] = [];
  let current: string[] = [];
  let start = -1;
  let cues = 0;
  for (const block of blocks) {
    const lines = block.split('\n');
    const timing = lines.findIndex((line) => CUE_TIME.test(line));
    if (timing < 0) {
      continue;
    }
    const match = CUE_TIME.exec(lines[timing] ?? '');
    const at =
      Number(match?.[1] ?? 0) * 3600 + Number(match?.[2] ?? 0) * 60 + Number(match?.[3] ?? 0);
    const text = lines
      .slice(timing + 1)
      .join(' ')
      .replace(/<[^>]*>|\{\\[^}]*\}/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    cues++;
    if (text === '') {
      continue;
    }
    if (current.length > 0 && at - start >= PARAGRAPH_SECONDS) {
      paragraphs.push(`[${clock(start)}] ${current.join(' ')}`);
      current = [];
    }
    if (current.length === 0) {
      start = at;
    }
    current.push(text);
  }
  if (current.length > 0) {
    paragraphs.push(`[${clock(start)}] ${current.join(' ')}`);
  }
  return cues === 0 ? file.trim() : paragraphs.join('\n');
}

/** `0:05`, `12:34`, `1:02:03`. */
export function clock(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor(totalSeconds / 60) % 60;
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return hours > 0
    ? `${String(hours)}:${String(minutes).padStart(2, '0')}:${seconds}`
    : `${String(minutes)}:${seconds}`;
}
