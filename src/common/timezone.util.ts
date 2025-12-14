/**
 * Timezone utility for Indonesia (WIB/UTC+7)
 */

const TIMEZONE_OFFSET = 7; // UTC+7 for WIB (Western Indonesian Time)

/**
 * Get current time in Indonesia timezone (UTC+7)
 */
export function getNowWIB(): Date {
  const now = new Date();
  // Add 7 hours to UTC to get WIB
  now.setHours(now.getUTCHours() + TIMEZONE_OFFSET);
  return now;
}

/**
 * Get today's date at midnight in WIB
 */
export function getTodayWIB(): Date {
  const now = getNowWIB();
  now.setHours(0, 0, 0, 0);
  return now;
}

/**
 * Get tomorrow's date at midnight in WIB
 */
export function getTomorrowWIB(): Date {
  const tomorrow = getTodayWIB();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow;
}

/**
 * Convert UTC date to WIB
 */
export function toWIB(date: Date): Date {
  const wib = new Date(date);
  wib.setHours(wib.getUTCHours() + TIMEZONE_OFFSET);
  return wib;
}

/**
 * Convert WIB date to UTC for storage
 */
export function toUTC(wibDate: Date): Date {
  const utc = new Date(wibDate);
  utc.setHours(utc.getHours() - TIMEZONE_OFFSET);
  return utc;
}

/**
 * Get current hour in WIB (0-23)
 */
export function getCurrentHourWIB(): number {
  return getNowWIB().getHours();
}

/**
 * Get current time string in WIB (HH:mm format)
 */
export function getCurrentTimeStringWIB(): string {
  const now = getNowWIB();
  const hours = now.getHours().toString().padStart(2, '0');
  const minutes = now.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * Get day of week in WIB
 */
export function getDayOfWeekWIB(): string {
  const days = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
  return days[getNowWIB().getDay()];
}

/**
 * Format date to YYYY-MM-DD in WIB
 */
export function formatDateWIB(date?: Date): string {
  const d = date ? toWIB(date) : getNowWIB();
  return d.toISOString().split('T')[0];
}

/**
 * Parse time string (HH:mm) to Date object in WIB for today
 */
export function parseTimeToDateWIB(time: string): Date {
  const [hours, minutes] = time.split(':').map(Number);
  const date = getTodayWIB();
  date.setHours(hours, minutes, 0, 0);
  return date;
}

/**
 * Check if current WIB time matches the given time string (within a minute window)
 */
export function isTimeMatchWIB(timeString: string): boolean {
  const currentTime = getCurrentTimeStringWIB();
  return currentTime === timeString;
}

/**
 * Get start of day in UTC for WIB date (for database queries)
 * When it's midnight in WIB, it's 17:00 previous day in UTC
 */
export function getStartOfDayUTC(): Date {
  const wibMidnight = getTodayWIB();
  return toUTC(wibMidnight);
}

/**
 * Get end of day in UTC for WIB date (for database queries)
 */
export function getEndOfDayUTC(): Date {
  const wibEndOfDay = getTomorrowWIB();
  return toUTC(wibEndOfDay);
}
