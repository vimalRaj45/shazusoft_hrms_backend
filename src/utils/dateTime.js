/**
 * Shazusoft HRMS Server DateTime & Timezone Utility
 * Ensures consistent handling of dates and times in the organization's business timezone (Asia/Kolkata).
 * Works reliably regardless of host machine / container timezone (UTC, US, etc.).
 */

export const DEFAULT_TIMEZONE = process.env.TIMEZONE || 'Asia/Kolkata';

/**
 * Returns today's date in YYYY-MM-DD format in the target timezone
 */
export function getTodayDateStr(timeZone = DEFAULT_TIMEZONE) {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    return formatter.format(new Date());
  } catch (e) {
    // Fallback if Intl fails
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
}

/**
 * Returns current month in YYYY-MM format in the target timezone
 */
export function getCurrentMonthStr(timeZone = DEFAULT_TIMEZONE) {
  return getTodayDateStr(timeZone).slice(0, 7);
}

/**
 * Returns current formatted time (e.g. "09:30:15 AM" or "09:30 AM") in the target timezone
 */
export function getNowTimeStr(timeZone = DEFAULT_TIMEZONE, includeSeconds = true) {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      second: includeSeconds ? '2-digit' : undefined,
      hour12: true
    }).formatToParts(new Date());

    const hour = parts.find(p => p.type === 'hour')?.value || '12';
    const minute = parts.find(p => p.type === 'minute')?.value || '00';
    const second = parts.find(p => p.type === 'second')?.value || '00';
    const dayPeriod = parts.find(p => p.type === 'dayPeriod')?.value?.toUpperCase() || 'AM';

    return includeSeconds
      ? `${hour}:${minute}:${second} ${dayPeriod}`
      : `${hour}:${minute} ${dayPeriod}`;
  } catch (e) {
    const now = new Date();
    let hours = now.getHours();
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    const strH = String(hours).padStart(2, '0');
    return includeSeconds ? `${strH}:${minutes}:${seconds} ${ampm}` : `${strH}:${minutes} ${ampm}`;
  }
}

/**
 * Returns current business hour and minute in target timezone (24-hour cycle)
 * Useful for late arrival checks (e.g. after 09:45 AM)
 */
export function getBusinessHoursAndMinutes(date = new Date(), timeZone = DEFAULT_TIMEZONE) {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour: 'numeric',
      minute: 'numeric',
      hour12: false
    }).formatToParts(date);

    let hour = parseInt(parts.find(p => p.type === 'hour')?.value || '0', 10);
    if (hour === 24) hour = 0;
    const minute = parseInt(parts.find(p => p.type === 'minute')?.value || '0', 10);

    return { hour, minute };
  } catch (e) {
    return { hour: date.getHours(), minute: date.getMinutes() };
  }
}

/**
 * Converts any time string (12h, 24h, ISO) to standard 12-hour AM/PM format (e.g., "09:30 AM")
 */
export function formatTime12h(timeStr, includeSeconds = false) {
  if (!timeStr || timeStr === '--' || timeStr === '--:--' || timeStr === 'In Progress' || timeStr === 'null') {
    return timeStr || '--:--';
  }

  const trimmed = String(timeStr).trim();

  // If already in 12h format (e.g. "09:30:15 AM", "9:30 AM", "9:30 PM")
  const ampmMatch = trimmed.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)$/i);
  if (ampmMatch) {
    const h = String(parseInt(ampmMatch[1], 10)).padStart(2, '0');
    const m = ampmMatch[2];
    const s = ampmMatch[3] || '00';
    const p = ampmMatch[4].toUpperCase();
    return includeSeconds && ampmMatch[3] ? `${h}:${m}:${s} ${p}` : `${h}:${m} ${p}`;
  }

  // Matches 24-hour "HH:mm:ss" or "HH:mm"
  const match24 = trimmed.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (match24) {
    let hours = parseInt(match24[1], 10);
    const minutes = match24[2];
    const seconds = match24[3] || '00';
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    const strHours = String(hours).padStart(2, '0');
    return includeSeconds && match24[3]
      ? `${strHours}:${minutes}:${seconds} ${ampm}`
      : `${strHours}:${minutes} ${ampm}`;
  }

  // Try parsing ISO date string
  try {
    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) {
      let hours = d.getHours();
      const minutes = String(d.getMinutes()).padStart(2, '0');
      const seconds = String(d.getSeconds()).padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12 || 12;
      const strHours = String(hours).padStart(2, '0');
      return includeSeconds
        ? `${strHours}:${minutes}:${seconds} ${ampm}`
        : `${strHours}:${minutes} ${ampm}`;
    }
  } catch (e) {}

  return trimmed;
}

/**
 * Converts any time string to 24-hour "HH:mm" format suitable for HTML <input type="time">
 */
export function timeTo24h(timeStr) {
  if (!timeStr || timeStr === '--' || timeStr === '--:--' || timeStr === 'In Progress') {
    return '09:30';
  }

  const trimmed = String(timeStr).trim();

  // Already 24h "HH:mm"
  const match24 = trimmed.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (match24 && !/AM|PM/i.test(trimmed)) {
    const h = String(parseInt(match24[1], 10)).padStart(2, '0');
    return `${h}:${match24[2]}`;
  }

  // 12h format "09:30 AM", "6:30 PM"
  const match12 = trimmed.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)$/i);
  if (match12) {
    let h = parseInt(match12[1], 10);
    const m = match12[2];
    const ampm = match12[3].toUpperCase();
    if (ampm === 'PM' && h < 12) h += 12;
    if (ampm === 'AM' && h === 12) h = 0;
    return `${String(h).padStart(2, '0')}:${m}`;
  }

  return '09:30';
}

/**
 * Parses dateStr and timeStr into a Date object
 */
export function parseTimeStrToDate(dateStr, timeStr) {
  if (!timeStr) return new Date();
  const trimmed = String(timeStr).trim();

  const match12 = trimmed.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)$/i);
  if (match12) {
    let hours = parseInt(match12[1], 10);
    const minutes = parseInt(match12[2], 10);
    const seconds = match12[3] ? parseInt(match12[3], 10) : 0;
    const ampm = match12[4].toUpperCase();
    if (ampm === 'PM' && hours < 12) hours += 12;
    if (ampm === 'AM' && hours === 12) hours = 0;
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d, hours, minutes, seconds);
  }

  const match24 = trimmed.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (match24) {
    const hours = parseInt(match24[1], 10);
    const minutes = parseInt(match24[2], 10);
    const seconds = match24[3] ? parseInt(match24[3], 10) : 0;
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d, hours, minutes, seconds);
  }

  try {
    const parsed = new Date(`${dateStr}T${trimmed}`);
    if (!isNaN(parsed.getTime())) return parsed;
  } catch (e) {}

  return new Date();
}
