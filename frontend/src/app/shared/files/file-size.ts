import { locale } from '@core/i18n/language';
import { SHARED_T } from '@shared/i18n/texts';

/** «2,5 МБ» for a size in bytes. */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${String(bytes)}\u00A0${SHARED_T.fileSize.bytes}`;
  }
  const units = SHARED_T.fileSize.units;
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value.toLocaleString(locale(), { maximumFractionDigits: 1 })}\u00A0${units[unit] ?? ''}`;
}
