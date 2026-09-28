import { hideHint, isHintHidden, readDeviceSetting, writeDeviceSetting } from './device-settings';

describe('device settings', () => {
  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('keeps settings and hidden hints on the device', () => {
    expect(readDeviceSetting('tb.test')).toBeNull();
    writeDeviceSetting('tb.test', 'yes');
    expect(readDeviceSetting('tb.test')).toBe('yes');

    expect(isHintHidden('tb.hint')).toBe(false);
    hideHint('tb.hint');
    expect(isHintHidden('tb.hint')).toBe(true);
  });

  it('works when the browser refuses storage', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });

    expect(() => {
      writeDeviceSetting('tb.test', 'yes');
    }).not.toThrow();
    expect(readDeviceSetting('tb.test')).toBeNull();
    expect(isHintHidden('tb.hint')).toBe(false);
  });
});
