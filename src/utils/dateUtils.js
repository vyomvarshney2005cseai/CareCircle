/**
 * Date and timezone helper functions.
 */

/**
 * Get current date formatted as YYYY-MM-DD in the given timezone.
 * @param {string} [timeZone='Asia/Kolkata']
 * @param {Date} [referenceDate=new Date()]
 * @returns {string} e.g. "2026-11-15"
 */
function getLocalDateString(timeZone = 'Asia/Kolkata', referenceDate = new Date()) {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    return formatter.format(referenceDate);
  } catch (err) {
    // Fallback if timezone invalid
    return referenceDate.toISOString().slice(0, 10);
  }
}

/**
 * Get day of week (0 = Sunday, 6 = Saturday) in the given timezone.
 * @param {string} [timeZone='Asia/Kolkata']
 * @param {Date} [referenceDate=new Date()]
 * @returns {number}
 */
function getLocalDayOfWeek(timeZone = 'Asia/Kolkata', referenceDate = new Date()) {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      weekday: 'narrow'
    });
    // Or format to weekday index
    const dateStr = getLocalDateString(timeZone, referenceDate);
    const [year, month, day] = dateStr.split('-').map(Number);
    // Construct local midnight date to get day index
    const localDate = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
    return localDate.getUTCDay();
  } catch (err) {
    return referenceDate.getDay();
  }
}

/**
 * Combine YYYY-MM-DD and HH:mm into an ISO string.
 * @param {string} dateStr "YYYY-MM-DD"
 * @param {string} timeStr "HH:mm"
 * @returns {string} ISO string
 */
function toScheduleIso(dateStr, timeStr) {
  const [hours, minutes] = timeStr.split(':').map(Number);
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(Date.UTC(year, month - 1, day, hours, minutes, 0, 0));
  return d.toISOString();
}

/**
 * Check if a date string (YYYY-MM-DD) is within startDate and endDate (inclusive).
 * @param {string} dateStr
 * @param {string} startDate
 * @param {string|null|undefined} endDate
 * @returns {boolean}
 */
function isDateWithinRange(dateStr, startDate, endDate) {
  if (dateStr < startDate) return false;
  if (endDate && dateStr > endDate) return false;
  return true;
}

/**
 * Get an array of date strings for the past N days up to today.
 * @param {number} days
 * @param {string} [timeZone='Asia/Kolkata']
 * @returns {string[]} array of "YYYY-MM-DD"
 */
function getPastNDates(days, timeZone = 'Asia/Kolkata') {
  const todayStr = getLocalDateString(timeZone);
  const [year, month, day] = todayStr.split('-').map(Number);
  const dates = [];

  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(Date.UTC(year, month - 1, day - i, 12, 0, 0));
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

module.exports = {
  getLocalDateString,
  getLocalDayOfWeek,
  toScheduleIso,
  isDateWithinRange,
  getPastNDates
};
