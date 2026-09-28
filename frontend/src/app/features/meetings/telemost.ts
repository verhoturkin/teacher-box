import { Injectable, signal } from '@angular/core';
import { readDeviceSetting, writeDeviceSetting } from '@shared/storage/device-settings';

const TELEMOST_HOSTS = ['telemost.yandex.ru', 'telemost.360.yandex.ru'];
/** Device setting: open Telemost links in the desktop application. */
export const OPEN_IN_APP_KEY = 'tb.meetings.open-in-app';

/** Whether the link opens a Telemost meeting. */
export function isTelemostLink(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return TELEMOST_HOSTS.includes(host) || host.endsWith('.telemost.yandex.ru');
  } catch {
    return false;
  }
}

/**
 * The link that opens a meeting in the Telemost desktop application: the web client of Telemost
 * opens the application the same way (`telemost://` + the address of the meeting).
 */
export function telemostAppLink(url: string): string {
  return `telemost://${url}`;
}

/** Whether this looks like a Windows computer (the application is installed there most often). */
export function isWindows(platform: string = navigator.userAgent): boolean {
  return /Windows/i.test(platform);
}

/**
 * Whether to open Telemost meetings in the desktop application on this device: on by default on
 * Windows, remembered in the browser.
 */
@Injectable({ providedIn: 'root' })
export class MeetingPreferences {
  readonly openInApp = signal(MeetingPreferences.stored());

  setOpenInApp(value: boolean): void {
    this.openInApp.set(value);
    writeDeviceSetting(OPEN_IN_APP_KEY, value ? 'yes' : 'no');
  }

  private static stored(): boolean {
    const value = readDeviceSetting(OPEN_IN_APP_KEY);
    return value === null ? isWindows() : value === 'yes';
  }
}
