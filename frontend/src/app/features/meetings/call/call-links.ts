import { CALL_PATH } from './call-session';

const OWNER = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The owner of a built-in room when the link is the portal's own `/call/<ownerId>` (ADR-0030): such a
 * link opens the call in place instead of a new tab.
 *
 * @param origins the addresses of this portal (the one it is opened at and the one in its settings)
 */
export function callOwnerOf(url: string, origins: readonly string[]): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (!origins.includes(parsed.origin) || !parsed.pathname.startsWith(CALL_PATH)) {
    return null;
  }
  const owner = parsed.pathname.slice(CALL_PATH.length);
  return OWNER.test(owner) ? owner : null;
}
