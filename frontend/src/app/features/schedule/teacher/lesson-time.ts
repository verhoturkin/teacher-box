/** `HH:mm` of a time picked in the dialog. */
export function toTime(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/** A date today with the time `HH:mm[:ss]` (for the time picker). */
export function fromTime(time: string): Date {
  const [hours = 0, minutes = 0] = time.split(':').map(Number);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date;
}
