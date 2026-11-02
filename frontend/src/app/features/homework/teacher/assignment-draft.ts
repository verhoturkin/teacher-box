const MAX_TITLE = 200;

/** The title of an assignment: its first non-empty line without Markdown marks. */
export function titleOf(text: string): string {
  const line = text.split('\n').find((candidate) => candidate.trim() !== '') ?? '';
  return line
    .replace(/^\s*(#{1,6}\s+|>\s*|[-*+]\s+|\d+[.)]\s+)/, '')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[*_`~]/g, '')
    .trim()
    .slice(0, MAX_TITLE);
}
