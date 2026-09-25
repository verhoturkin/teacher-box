/** «2,5 МБ» for a size in bytes. */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${String(bytes)} Б`;
  }
  const units = ['КБ', 'МБ', 'ГБ'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value.toLocaleString('ru-RU', { maximumFractionDigits: 1 })} ${units[unit] ?? ''}`;
}
