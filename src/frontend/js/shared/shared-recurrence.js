/**
 * shared-recurrence.js — Recurrence expansion and formatting helpers.
 *
 * Provides recurrence rule formatting, virtual instance expansion for
 * calendar date ranges, series info computation, and date advancement
 * by recurrence frequency.
 *
 * Depends on: shared-calendar.js (for getCalendarDateInfo)
 */

function _advanceRecurrence(current, freq, interval, byDayNums) {
  if (freq === 'MINUTELY') current.setMinutes(current.getMinutes() + interval);
  else if (freq === 'HOURLY') current.setHours(current.getHours() + interval);
  else if (freq === 'DAILY') current.setDate(current.getDate() + interval);
  else if (freq === 'WEEKLY') {
    if (byDayNums && byDayNums.length > 0) {
      current.setDate(current.getDate() + 1);
      if (current.getDay() === byDayNums[0] && interval > 1) {
        current.setDate(current.getDate() + (interval - 1) * 7);
      }
    } else {
      current.setDate(current.getDate() + interval * 7);
    }
  } else if (freq === 'MONTHLY') current.setMonth(current.getMonth() + interval);
  else if (freq === 'YEARLY') current.setFullYear(current.getFullYear() + interval);
  else return false; // unknown freq
  return true;
}

/**
 * Expand a recurring chit into virtual instances for a date range.
 */
function expandRecurrence(chit, rangeStart, rangeEnd) {
  const rule = chit.recurrence_rule;
  if (!rule || !rule.freq) return [chit]; // not recurring, return as-is

  const exceptions = chit.recurrence_exceptions || [];
  const exceptionDates = new Set(exceptions.map(e => e.date));
  const brokenOffDates = new Set(exceptions.filter(e => e.broken_off).map(e => e.date));
  const completedDates = new Set(exceptions.filter(e => e.completed).map(e => e.date));

  const info = getCalendarDateInfo(chit);
  if (!info.hasDate) return [chit];

  const baseDate = new Date(info.start);
  baseDate.setHours(0, 0, 0, 0);
  const baseTimeMs = info.start.getTime() - baseDate.getTime(); // time-of-day offset
  const durationMs = info.isAllDay ? 0 : (info.end.getTime() - info.start.getTime());

  const freq = rule.freq;
  const interval = rule.interval || 1;
  const byDay = rule.byDay || []; // ["MO","TU","WE","TH","FR","SA","SU"]
  const until = rule.until ? new Date(rule.until) : null;

  const dayMap = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };
  const byDayNums = byDay.map(d => dayMap[d]).filter(n => n !== undefined);

  const instances = [];
  const maxInstances = 365; // safety limit
  let current = new Date(baseDate);
  let count = 0;
  let occurrenceNum = 0; // counts all non-broken-off occurrences from series start

  while (count < maxInstances) {
    if (until && current > until) break;
    if (current > rangeEnd) break;

    const dateStr = current.toISOString().slice(0, 10);
    // For sub-daily frequencies, use datetime as the instance key
    const isSubDaily = freq === 'MINUTELY' || freq === 'HOURLY';
    const instanceKey = isSubDaily ? current.toISOString().slice(0, 16) : dateStr; // YYYY-MM-DDTHH:MM or YYYY-MM-DD
    const inRange = current >= rangeStart;

    // For weekly with byDay, check if current day matches
    let dayMatches = true;
    if (freq === 'WEEKLY' && byDayNums.length > 0) {
      dayMatches = byDayNums.includes(current.getDay());
    }

    if (dayMatches && !brokenOffDates.has(instanceKey)) {
      occurrenceNum++;
    }

    if (dayMatches && inRange && !brokenOffDates.has(instanceKey)) {
      // Check for exception modifications
      const exception = exceptions.find(e => e.date === instanceKey && !e.broken_off);

      const virtualStart = new Date(current.getTime() + baseTimeMs);
      const virtualEnd = info.isAllDay ? virtualStart : new Date(virtualStart.getTime() + durationMs);

      const instance = {
        ...chit,
        _isVirtual: true,
        _parentId: chit.id,
        _virtualDate: instanceKey,
        _isCompleted: completedDates.has(instanceKey),
        _instanceNum: occurrenceNum,
      };

      // Mark completed instances visually
      if (instance._isCompleted) {
        instance.status = 'Complete';
      }

      // Apply exception overrides
      if (exception) {
        if (exception.title) instance.title = exception.title;
        if (exception.note !== undefined) instance.note = exception.note;
        if (exception.location !== undefined) instance.location = exception.location;
        if (exception.start_datetime) {
          instance.start_datetime = exception.start_datetime;
        } else if (!info.isDueOnly) {
          instance.start_datetime = virtualStart.toISOString();
          instance.end_datetime = virtualEnd.toISOString();
        }
        if (exception.end_datetime) instance.end_datetime = exception.end_datetime;
        if (exception.due_datetime) instance.due_datetime = exception.due_datetime;
      } else {
        if (info.isDueOnly) {
          instance.due_datetime = virtualStart.toISOString();
        } else {
          instance.start_datetime = virtualStart.toISOString();
          instance.end_datetime = virtualEnd.toISOString();
        }
      }

      // Update the datetime objects for calendar rendering
      if (instance.start_datetime) instance.start_datetime_obj = new Date(instance.start_datetime);
      if (instance.end_datetime) instance.end_datetime_obj = new Date(instance.end_datetime);

      instances.push(instance);
    }

    // Advance to next occurrence
    count++;
    if (!_advanceRecurrence(current, freq, interval, byDayNums)) break;
  }

  return instances.length > 0 ? instances : [chit];
}

/**
 * Format a recurrence rule as a human-readable string.
 * @param {object} rule - { freq, interval, byDay, until }
 * @returns {string}
 */
function formatRecurrenceRule(rule) {
  if (!rule || !rule.freq) return '';
  const freq = rule.freq;
  const interval = rule.interval || 1;
  const dayNames = { MO: 'Mon', TU: 'Tue', WE: 'Wed', TH: 'Thu', FR: 'Fri', SA: 'Sat', SU: 'Sun' };

  let text = '';
  if (freq === 'MINUTELY') text = interval === 1 ? 'Every minute' : `Every ${interval} minutes`;
  else if (freq === 'HOURLY') text = interval === 1 ? 'Hourly' : `Every ${interval} hours`;
  else if (freq === 'DAILY') text = interval === 1 ? 'Daily' : `Every ${interval} days`;
  else if (freq === 'WEEKLY') {
    const days = (rule.byDay || []).map(d => dayNames[d] || d).join(', ');
    text = interval === 1 ? `Weekly` : `Every ${interval} weeks`;
    if (days) text += ` on ${days}`;
  }
  else if (freq === 'MONTHLY') text = interval === 1 ? 'Monthly' : `Every ${interval} months`;
  else if (freq === 'YEARLY') text = interval === 1 ? 'Yearly' : `Every ${interval} years`;
  else text = freq;

  if (rule.until) text += ` until ${new Date(rule.until).toLocaleDateString()}`;
  return text;
}


// ── Recurrence Series Info (Phase R3) ────────────────────────────────────────

/**
 * Count which occurrence number a virtual date is in a series,
 * and how many total past instances exist, how many are completed.
 * @param {object} chit - the parent chit with recurrence_rule
 * @param {string} virtualDate - YYYY-MM-DD of the instance
 * @returns {{ instanceNum: number, totalPast: number, completedPast: number, successRate: number }}
 */
function getRecurrenceSeriesInfo(chit, virtualDate) {
  const rule = chit.recurrence_rule;
  if (!rule || !rule.freq) return null;

  const exceptions = chit.recurrence_exceptions || [];
  const brokenOffDates = new Set(exceptions.filter(e => e.broken_off).map(e => e.date));
  const completedDates = new Set(exceptions.filter(e => e.completed).map(e => e.date));

  const info = getCalendarDateInfo(chit);
  if (!info.hasDate) return null;

  const baseDate = new Date(info.start);
  baseDate.setHours(0, 0, 0, 0);
  const freq = rule.freq;
  const interval = rule.interval || 1;
  const byDay = rule.byDay || [];
  const until = rule.until ? new Date(rule.until) : null;
  const dayMap = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };
  const byDayNums = byDay.map(d => dayMap[d]).filter(n => n !== undefined);

  const today = new Date();
  today.setHours(23, 59, 59, 999);
  const targetDate = virtualDate ? new Date(virtualDate + 'T23:59:59') : today;

  let current = new Date(baseDate);
  let instanceNum = 0;
  let totalPast = 0;
  let completedPast = 0;
  const maxIter = 730;

  for (let i = 0; i < maxIter; i++) {
    if (until && current > until) break;
    if (current > today && current > targetDate) break;

    const dateStr = current.toISOString().slice(0, 10);
    let dayMatches = true;
    if (freq === 'WEEKLY' && byDayNums.length > 0) {
      dayMatches = byDayNums.includes(current.getDay());
    }

    if (dayMatches && !brokenOffDates.has(dateStr)) {
      if (current <= today) {
        totalPast++;
        if (completedDates.has(dateStr)) completedPast++;
      }
      if (current <= targetDate) instanceNum++;
    }

    // Advance
    if (!_advanceRecurrence(current, freq, interval, byDayNums)) break;
  }

  const successRate = totalPast > 0 ? Math.round((completedPast / totalPast) * 100) : 0;
  return { instanceNum, totalPast, completedPast, successRate };
}

