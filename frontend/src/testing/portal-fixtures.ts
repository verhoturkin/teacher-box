import { PortalSettings } from '@core/portal/portal';

export function portalSettings(overrides: Partial<PortalSettings> = {}): PortalSettings {
  return {
    name: 'Teacher Box',
    address: null,
    addressFromEnvironment: false,
    setupCompleted: true,
    ...overrides,
  };
}
