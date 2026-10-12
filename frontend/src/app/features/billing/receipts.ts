/** Files a receipt may be: pictures and PDF, as the backend recognizes them by their first bytes. */
export const RECEIPT_ACCEPT = 'image/jpeg,image/png,image/webp,image/heic,.heic,application/pdf';

/** The largest receipt, as on the backend. */
export const RECEIPT_MAX_SIZE = 10 * 1024 * 1024;

/** A PDF or a picture the browser shows in a tab; a HEIC photo is saved instead. */
export function showableReceipt(contentType: string): boolean {
  return contentType !== 'image/heic';
}
