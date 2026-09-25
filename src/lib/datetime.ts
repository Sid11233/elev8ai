// Admins enter times in Mauritius time. Mauritius has no daylight saving, so a
// fixed +04:00 offset converts exactly, and server and browser render the same.
export const APP_TIME_ZONE = "Indian/Mauritius";
const APP_UTC_OFFSET = "+04:00";
const OFFSET_MS = 4 * 60 * 60 * 1000;

// "2026-10-01T18:00" (a datetime-local value in Mauritius time) -> ISO string in UTC.
export function localInputToIso(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const date = new Date(`${value}:00${APP_UTC_OFFSET}`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

// ISO string -> "2026-10-01T18:00" for a datetime-local input, in Mauritius time.
export function isoToLocalInput(iso: string | null): string {
  if (!iso) return "";
  return new Date(new Date(iso).getTime() + OFFSET_MS).toISOString().slice(0, 16);
}

const dateFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: APP_TIME_ZONE,
  day: "numeric",
  month: "short",
});
const dateTimeFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: APP_TIME_ZONE,
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatDate(iso: string) {
  return dateFormat.format(new Date(iso));
}

export function formatDateTime(iso: string) {
  return dateTimeFormat.format(new Date(iso));
}
