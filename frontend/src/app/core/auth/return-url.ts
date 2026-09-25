/**
 * Accepts only local absolute paths as a post-login redirect target (prevents open redirects
 * such as `//evil.example` or `https://evil.example`).
 */
export function safeReturnUrl(url: string | undefined | null): string | null {
  if (url === undefined || url === null || !url.startsWith('/') || url.startsWith('//') || url.startsWith('/\\')) {
    return null;
  }
  return url;
}
