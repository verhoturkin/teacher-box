import { deviceName } from './device-name';

describe('deviceName', () => {
  it.each([
    [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0 Safari/537.36',
      'Chrome · Windows',
    ],
    [
      'Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/130.0 Safari/537.36 Edg/130.0',
      'Edge · Windows',
    ],
    [
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1 Version/17.0 Safari/604.1',
      'Safari · iPhone',
    ],
    ['Mozilla/5.0 (Android 14; Mobile; rv:130.0) Gecko/130.0 Firefox/130.0', 'Firefox · Android'],
    ['Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Version/17.0 Safari/605.1', 'Safari · macOS'],
  ])('names %s', (agent, name) => {
    expect(deviceName(agent, 'Device')).toBe(name);
  });

  it('gives the fallback for an unknown or missing agent', () => {
    expect(deviceName(null, 'Device')).toBe('Device');
    expect(deviceName('curl/8', 'Device')).toBe('Device');
  });
});
