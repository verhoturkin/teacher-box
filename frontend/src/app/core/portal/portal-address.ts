import { AbstractControl, ValidationErrors } from '@angular/forms';

/** The longest address the server accepts. */
export const MAX_ADDRESS_LENGTH = 300;
/** The longest name of the portal. */
export const MAX_PORTAL_NAME_LENGTH = 60;

/**
 * `https://school.example.com` from what the user typed, or `null` when it is not an address of the
 * portal: only http(s), a host and a port, without a path (the same rules as on the server).
 */
export function normalizeAddress(value: string): string | null {
  const trimmed = value.trim();
  if (
    trimmed === '' ||
    trimmed.length > MAX_ADDRESS_LENGTH ||
    !/^https?:\/\/[^/?#]/i.test(trimmed)
  ) {
    return null;
  }
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  const bare = trimmed.replace(/\/$/, '');
  if (url.pathname !== '/' || /[?#]/.test(bare) || url.username !== '' || url.password !== '') {
    return null;
  }
  return url.origin;
}

/** Form validator: empty or an address of the portal (`portalAddress` error otherwise). */
export function portalAddressValidator(control: AbstractControl<string>): ValidationErrors | null {
  return control.value.trim() === '' || normalizeAddress(control.value) !== null
    ? null
    : { portalAddress: true };
}

/** Why the students may not reach the portal by this address. */
export type AddressWarning = 'local' | 'home-network' | 'elsewhere' | 'unencrypted';

const PRIVATE_IPV4 = /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.)/;
const LOCAL_HOSTS = /^(localhost|.+\.localhost|127\.\d+\.\d+\.\d+|\[::1\]|0\.0\.0\.0)$/;
const HOME_NAMES = /(\.local|\.lan|\.home|\.internal)$/;

/**
 * @param address  the normalized address
 * @param openedAt the address the page is opened at
 */
export function addressWarnings(address: string, openedAt: string): AddressWarning[] {
  const url = new URL(address);
  const host = url.hostname.toLowerCase();
  const warnings: AddressWarning[] = [];
  const local = LOCAL_HOSTS.test(host);
  const home = !local && (PRIVATE_IPV4.test(host) || HOME_NAMES.test(host) || !host.includes('.'));
  if (local) {
    warnings.push('local');
  } else if (home) {
    warnings.push('home-network');
  } else if (url.protocol === 'http:') {
    warnings.push('unencrypted');
  }
  if (address !== openedAt) {
    warnings.push('elsewhere');
  }
  return warnings;
}
