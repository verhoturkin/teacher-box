/** Most pages put on a board at once: each is a picture of about a megabyte. */
export const MAX_BOARD_PAGES = 30;

/** Pages the teacher wrote, as the backend's `PageRanges` reads them. */
export interface ParsedPages {
  readonly pages: readonly number[];
  /** Normalized: «2-4, 7». */
  readonly text: string;
}

/**
 * Reads «2-4, 7» (commas, spaces, `-` / `–` / `—`); `null` for anything else, a page past `pageCount` or more
 * than `max` pages.
 */
export function parsePages(
  value: string,
  pageCount: number | null,
  max = MAX_BOARD_PAGES,
): ParsedPages | null {
  const parts = value
    .trim()
    .replace(/\s*[-–—]\s*/g, '-')
    .split(/[,;\s]+/)
    .filter((part) => part !== '');
  const pages = new Set<number>();
  for (const part of parts) {
    const match = /^(\d{1,5})(?:-(\d{1,5}))?$/.exec(part);
    if (match === null) return null;
    const from = Number(match[1]);
    const to = match[2] === undefined ? from : Number(match[2]);
    if (from < 1 || to < from || (pageCount !== null && to > pageCount) || to - from >= max) {
      return null;
    }
    for (let page = from; page <= to; page++) pages.add(page);
    if (pages.size > max) return null;
  }
  if (pages.size === 0) return null;
  const sorted = [...pages].sort((a, b) => a - b);
  return { pages: sorted, text: rangesText(sorted) };
}

function rangesText(pages: readonly number[]): string {
  const parts: string[] = [];
  let start = pages[0] ?? 0;
  let previous = start;
  for (const page of pages.slice(1)) {
    if (page !== previous + 1) {
      parts.push(start === previous ? String(start) : `${String(start)}-${String(previous)}`);
      start = page;
    }
    previous = page;
  }
  parts.push(start === previous ? String(start) : `${String(start)}-${String(previous)}`);
  return parts.join(', ');
}
