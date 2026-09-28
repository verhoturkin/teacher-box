import { PortalInfo, PortalSettings } from '@core/portal/portal';

export function portalInfo(overrides: Partial<PortalInfo> = {}): PortalInfo {
  return { name: 'Teacher Box', address: null, accent: 'indigo', logo: null, ...overrides };
}

export function portalSettings(overrides: Partial<PortalSettings> = {}): PortalSettings {
  return {
    name: 'Teacher Box',
    address: null,
    accent: 'indigo',
    logo: null,
    addressFromEnvironment: false,
    setupCompleted: true,
    ...overrides,
  };
}
