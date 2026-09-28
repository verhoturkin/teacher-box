/**
 * Settings kept on this device (`localStorage`): hidden hints, how to open meetings. When the
 * browser refuses storage (a private window, blocked site data), reading gives `null` and writing is
 * skipped — the setting lasts for this page only.
 */
export function readDeviceSetting(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeDeviceSetting(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Not kept: the setting lasts for this page only.
  }
}

/** A hint the user hid on this device. */
export function isHintHidden(key: string): boolean {
  return readDeviceSetting(key) === '1';
}

export function hideHint(key: string): void {
  writeDeviceSetting(key, '1');
}
