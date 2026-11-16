/** Document Picture-in-Picture (Chromium only); not in TypeScript's DOM types yet. */
interface PipApi {
  requestWindow(options: { width: number; height: number }): Promise<Window>;
}

declare global {
  interface Window {
    documentPictureInPicture?: PipApi;
  }
}

/** The browser can float the call over other tabs and apps. */
export const pipSupported = (): boolean => window.documentPictureInPicture !== undefined;

/**
 * Moves `element` with the portal styles and theme to a floating window; when the window closes the
 * element comes back to its place, unless it was destroyed meanwhile, and `closed` runs.
 */
export async function openPip(element: HTMLElement, closed: () => void): Promise<Window> {
  const api = window.documentPictureInPicture;
  if (api === undefined) {
    throw new Error('Document Picture-in-Picture is not supported');
  }
  const pip = await api.requestWindow({ width: 480, height: 360 });
  const target = pip.document;
  target.documentElement.className = document.documentElement.className;
  target.documentElement.lang = document.documentElement.lang;
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      const style = target.createElement('style');
      style.textContent = Array.from(sheet.cssRules, (rule) => rule.cssText).join('\n');
      target.head.append(style);
    } catch {
      // A cross-origin sheet hides its rules: link it instead
      if (sheet.href !== null) {
        const link = target.createElement('link');
        link.rel = 'stylesheet';
        link.href = sheet.href;
        target.head.append(link);
      }
    }
  }
  const parent = element.parentNode;
  const next = element.nextSibling;
  target.body.append(element);
  pip.addEventListener(
    'pagehide',
    () => {
      if (element.isConnected && parent !== null) {
        parent.insertBefore(element, next?.parentNode === parent ? next : null);
      }
      closed();
    },
    { once: true },
  );
  return pip;
}
