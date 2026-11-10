import { normalizeAddress } from './portal-address';

/** How long «Проверить» waits for the portal at another address. */
export const CHECK_TIMEOUT_MS = 8000;

/** The result of «Проверить»: the portal opened at the address, or it did not from this device. */
export type AddressCheck = 'opens' | 'fails';

/**
 * Whether the portal opens at `address` from this device (our decision: the page may only connect to its
 * own origin, so another address is checked by loading the portal's app icon from it as an image). The
 * address the page is open at opens by definition.
 */
export function checkAddress(
  address: string,
  openedAt: string,
  timeout = CHECK_TIMEOUT_MS,
): Promise<AddressCheck> {
  const normalized = normalizeAddress(address);
  if (normalized === null) {
    return Promise.resolve('fails');
  }
  if (normalized === normalizeAddress(openedAt)) {
    return Promise.resolve('opens');
  }
  return new Promise((resolve) => {
    const image = new Image();
    const timer = setTimeout(() => {
      done('fails');
    }, timeout);
    function done(result: AddressCheck): void {
      clearTimeout(timer);
      image.onload = null;
      image.onerror = null;
      image.src = '';
      resolve(result);
    }
    image.onload = () => {
      done('opens');
    };
    image.onerror = () => {
      done('fails');
    };
    image.src = `${normalized}/icons/icon-192.png?check=${String(Date.now())}`;
  });
}
