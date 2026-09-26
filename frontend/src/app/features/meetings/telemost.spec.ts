import { TestBed } from '@angular/core/testing';
import { MeetingPreferences, OPEN_IN_APP_KEY, isTelemostLink, isWindows, telemostAppLink } from './telemost';

describe('telemost', () => {
  afterEach(() => {
    localStorage.removeItem(OPEN_IN_APP_KEY);
  });

  it('recognizes Telemost links', () => {
    expect(isTelemostLink('https://telemost.yandex.ru/j/123')).toBe(true);
    expect(isTelemostLink('https://telemost.360.yandex.ru/j/123')).toBe(true);
    expect(isTelemostLink('https://zoom.us/j/1')).toBe(false);
    expect(isTelemostLink('not a link')).toBe(false);
  });

  it('opens a meeting in the desktop application like the web client of Telemost', () => {
    expect(telemostAppLink('https://telemost.yandex.ru/j/123')).toBe('telemost://https://telemost.yandex.ru/j/123');
  });

  it('detects Windows', () => {
    expect(isWindows('Mozilla/5.0 (Windows NT 10.0; Win64; x64)')).toBe(true);
    expect(isWindows('Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)')).toBe(false);
  });

  it('remembers the choice on the device', () => {
    localStorage.setItem(OPEN_IN_APP_KEY, 'no');
    const preferences = TestBed.inject(MeetingPreferences);
    expect(preferences.openInApp()).toBe(false);

    preferences.setOpenInApp(true);

    expect(preferences.openInApp()).toBe(true);
    expect(localStorage.getItem(OPEN_IN_APP_KEY)).toBe('yes');
  });

  it('falls back to the platform without storage', () => {
    const storage = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const preferences = TestBed.inject(MeetingPreferences);

    expect(preferences.openInApp()).toBe(isWindows());
    preferences.setOpenInApp(true);
    expect(preferences.openInApp()).toBe(true);
    storage.mockRestore();
  });
});
