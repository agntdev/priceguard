let clockFn: () => Date = () => new Date();

export function now(): Date {
  return clockFn();
}

export function setClock(fn: () => Date): void {
  clockFn = fn;
}

export function resetClock(): void {
  clockFn = () => new Date();
}

export function formatTime(date: Date, timezone: string): string {
  try {
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
      timeZone: timezone,
    });
  } catch {
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  }
}

export function isQuietHours(
  quietStart: string,
  quietEnd: string,
  timezone: string,
): boolean {
  const nowDate = now();
  let currentHour: number;
  let currentMinute: number;
  try {
    const parts = nowDate.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: timezone,
    }).split(":");
    currentHour = parseInt(parts[0], 10);
    currentMinute = parseInt(parts[1], 10);
  } catch {
    currentHour = nowDate.getUTCHours();
    currentMinute = nowDate.getUTCMinutes();
  }

  const [startH, startM] = quietStart.split(":").map(Number);
  const [endH, endM] = quietEnd.split(":").map(Number);

  const currentMinutes = currentHour * 60 + currentMinute;
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  if (startMinutes > endMinutes) {
    // Wraps midnight (e.g., 23:00-07:00)
    return currentMinutes >= startMinutes || currentMinutes < endMinutes;
  }
  return currentMinutes >= startMinutes && currentMinutes < endMinutes;
}

export function isCooldownActive(
  lastAlertTime: number | undefined,
  cooldownHours: number,
): boolean {
  if (!lastAlertTime) return false;
  const diff = now().getTime() - lastAlertTime;
  return diff < cooldownHours * 60 * 60 * 1000;
}

export function parseTimezone(tz: string): string | null {
  try {
    new Date().toLocaleString("en-US", { timeZone: tz });
    return tz;
  } catch {
    return null;
  }
}

export const COMMON_TIMEZONES = [
  { label: "UTC", value: "UTC" },
  { label: "US Eastern (ET)", value: "America/New_York" },
  { label: "US Pacific (PT)", value: "America/Los_Angeles" },
  { label: "London (GMT/BST)", value: "Europe/London" },
  { label: "Central Europe (CET)", value: "Europe/Berlin" },
  { label: "Tokyo (JST)", value: "Asia/Tokyo" },
  { label: "Sydney (AEST)", value: "Australia/Sydney" },
  { label: "India (IST)", value: "Asia/Kolkata" },
  { label: "Dubai (GST)", value: "Asia/Dubai" },
  { label: "Singapore (SGT)", value: "Asia/Singapore" },
];

export const CURRENCIES = [
  { label: "USD ($)", value: "usd" },
  { label: "EUR (€)", value: "eur" },
  { label: "GBP (£)", value: "gbp" },
  { label: "JPY (¥)", value: "jpy" },
  { label: "AUD (A$)", value: "aud" },
  { label: "CAD (C$)", value: "cad" },
  { label: "CHF (Fr)", value: "chf" },
];

export const SUMMARY_TIMES = [
  { label: "7:00 AM", value: "07:00" },
  { label: "8:00 AM", value: "08:00" },
  { label: "9:00 AM", value: "09:00" },
  { label: "10:00 AM", value: "10:00" },
];
