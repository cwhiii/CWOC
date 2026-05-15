/**
 * shared-recurrence.js — Recurrence expansion and formatting helpers.
 *
 * Provides recurrence rule formatting, virtual instance expansion for
 * calendar date ranges, series info computation, and date advancement
 * by recurrence frequency.
 *
 * Timezone-aware: anchored chits expand in their stored timezone,
 * floating chits expand in the user's current timezone. Daily+ frequencies
 * preserve wall-clock time across DST; sub-daily frequencies maintain
 * uniform elapsed-time intervals (UTC-based).
 *
 * Depends on: shared-calendar.js (for getCalendarDateInfo), shared-utils.js (for getCurrentTimezone)
 */

// ── Timezone-Aware Helpers ───────────────────────────────────────────────────

/**
 * Parse a naive ISO datetime string into its components.
 * @param {string} isoStr - e.g. "2025-03-09T02:30:00"
 * @returns {{year:number, month:number, day:number, hour:number, minute:number, second:number}|null}
 */
function _parseNaiveDatetime(isoStr) {
  if (!isoStr) return null;
  var m = isoStr.match(/(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return null;
  return {
    year: parseInt(m[1], 10),
    month: parseInt(m[2], 10),  // 1-based
    day: parseInt(m[3], 10),
    hour: parseInt(m[4], 10),
    minute: parseInt(m[5], 10),
    second: m[6] ? parseInt(m[6], 10) : 0
  };
}

/**
 * Convert a naive wall-clock datetime (components) in a given timezone to a UTC millisecond timestamp.
 * Handles DST gaps by shifting forward to the first valid instant.
 * Handles DST ambiguity (fall-back) by selecting the first occurrence (fold=0, earlier UTC).
 * @param {{year:number, month:number, day:number, hour:number, minute:number, second:number}} parts
 * @param {string} tzName - IANA timezone
 * @returns {number} UTC milliseconds
 */
function _wallClockToUtcMs(parts, tzName) {
  // Strategy: create a UTC date with the wall-clock components, then determine
  // the offset that tzName applies at that moment, and adjust.
  var utcGuess = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);

  // Format that UTC instant in the target timezone to see what wall-clock it maps to
  var formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: tzName,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false
  });
  var fp = {};
  formatter.formatToParts(new Date(utcGuess)).forEach(function(p) { fp[p.type] = p.value; });

  var wallYear = parseInt(fp.year, 10);
  var wallMonth = parseInt(fp.month, 10);
  var wallDay = parseInt(fp.day, 10);
  var wallHour = parseInt(fp.hour, 10) === 24 ? 0 : parseInt(fp.hour, 10);
  var wallMinute = parseInt(fp.minute, 10);
  var wallSecond = parseInt(fp.second, 10);

  // Offset = (wall-clock in tz) - (UTC components treated as local)
  var wallMs = Date.UTC(wallYear, wallMonth - 1, wallDay, wallHour, wallMinute, wallSecond);
  var offsetMs = wallMs - utcGuess;

  // The true UTC instant for our desired wall-clock time
  var trueUtc = utcGuess - offsetMs;

  // Verify: format trueUtc in the timezone and check if it matches our desired wall-clock
  var verifyParts = {};
  formatter.formatToParts(new Date(trueUtc)).forEach(function(p) { verifyParts[p.type] = p.value; });
  var vHour = parseInt(verifyParts.hour, 10) === 24 ? 0 : parseInt(verifyParts.hour, 10);
  var vMinute = parseInt(verifyParts.minute, 10);

  if (vHour !== parts.hour || vMinute !== parts.minute) {
    // DST gap: the requested wall-clock time doesn't exist.
    // Shift forward to the first valid instant after the gap.
    // The gap starts at the transition point. We need to find the exact moment
    // where the clock jumps forward (e.g., 2:00 AM -> 3:00 AM).
    // Strategy: binary search backward from trueUtc to find the gap boundary,
    // then return that boundary (which is the first valid instant after the gap).
    
    // The trueUtc we computed is offset by the gap amount. The first valid instant
    // after the gap is the transition point itself. We can find it by searching
    // for the minute where the wall-clock hour first becomes > parts.hour.
    var searchMs = utcGuess - offsetMs; // start from our initial computation
    // Go back to find the exact transition point (start of the new hour)
    // The transition is typically at a round hour. Search backward from trueUtc.
    var transitionSearch = trueUtc;
    // First, go back to just before the gap
    var preGapMs = transitionSearch - 3600000; // 1 hour before
    for (var gi = 0; gi <= 60; gi++) {
      var testMs = preGapMs + (gi * 60000);
      var gp = {};
      formatter.formatToParts(new Date(testMs)).forEach(function(p) { gp[p.type] = p.value; });
      var gHour = parseInt(gp.hour, 10) === 24 ? 0 : parseInt(gp.hour, 10);
      var gMinute = parseInt(gp.minute, 10);
      // The first instant where wall-clock is past the gap start
      if (gHour > parts.hour || (gHour === parts.hour && gMinute > parts.minute)) {
        // This is the first valid instant after the gap
        return testMs;
      }
      // Also check: if we've reached the post-gap hour at minute 0, that's the transition
      if (gHour === parts.hour + 1 && gMinute === 0) {
        return testMs;
      }
    }
    // Fallback: return the computed trueUtc (already shifted past the gap)
    return trueUtc;
  }

  // For fall-back ambiguity (same wall-clock occurs twice):
  // Our algorithm naturally picks the first occurrence (earlier UTC) because
  // we compute offset from the UTC guess which maps to the first instance.
  // This is the fold=0 behavior we want.

  return trueUtc;
}

/**
 * Convert a UTC millisecond timestamp to wall-clock components in a given timezone.
 * @param {number} utcMs - UTC milliseconds
 * @param {string} tzName - IANA timezone
 * @returns {{year:number, month:number, day:number, hour:number, minute:number, second:number}}
 */
function _utcMsToWallClock(utcMs, tzName) {
  var formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: tzName,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false
  });
  var fp = {};
  formatter.formatToParts(new Date(utcMs)).forEach(function(p) { fp[p.type] = p.value; });
  return {
    year: parseInt(fp.year, 10),
    month: parseInt(fp.month, 10),  // 1-based
    day: parseInt(fp.day, 10),
    hour: parseInt(fp.hour, 10) === 24 ? 0 : parseInt(fp.hour, 10),
    minute: parseInt(fp.minute, 10),
    second: parseInt(fp.second, 10)
  };
}

/**
 * Advance wall-clock date components by a recurrence frequency in a timezone.
 * For daily+ frequencies, this preserves wall-clock time (e.g., 9:00 AM stays 9:00 AM).
 * Handles DST gaps and ambiguity via _wallClockToUtcMs.
 * @param {{year:number, month:number, day:number, hour:number, minute:number, second:number}} parts
 * @param {string} freq - DAILY, WEEKLY, MONTHLY, YEARLY
 * @param {number} interval
 * @param {number[]} byDayNums - for WEEKLY with byDay
 * @returns {{year:number, month:number, day:number, hour:number, minute:number, second:number}} new parts
 */
function _advanceWallClock(parts, freq, interval, byDayNums) {
  // Create a temp date for date arithmetic (using UTC to avoid local DST issues)
  var d = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));

  if (freq === 'DAILY') {
    d.setUTCDate(d.getUTCDate() + interval);
  } else if (freq === 'WEEKLY') {
    if (byDayNums && byDayNums.length > 0) {
      d.setUTCDate(d.getUTCDate() + 1);
      if (d.getUTCDay() === byDayNums[0] && interval > 1) {
        d.setUTCDate(d.getUTCDate() + (interval - 1) * 7);
      }
    } else {
      d.setUTCDate(d.getUTCDate() + interval * 7);
    }
  } else if (freq === 'MONTHLY') {
    d.setUTCMonth(d.getUTCMonth() + interval);
  } else if (freq === 'YEARLY') {
    d.setUTCFullYear(d.getUTCFullYear() + interval);
  }

  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    hour: parts.hour,    // preserve wall-clock time
    minute: parts.minute,
    second: parts.second
  };
}

/**
 * Check if a timezone is valid/recognized by the browser's Intl API.
 * @param {string} tzName - IANA timezone string
 * @returns {boolean}
 */
function _isRecurrenceTzValid(tzName) {
  if (!tzName) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tzName });
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Resolve the effective timezone for recurrence expansion.
 * - Anchored chits: use chit.timezone (fall back to user's default if unrecognized)
 * - Floating chits: use user's current timezone
 * @param {object} chit
 * @param {string} currentTz - user's resolved current timezone
 * @returns {string} IANA timezone to use for expansion
 */
function _resolveRecurrenceTz(chit, currentTz) {
  if (chit.timezone) {
    if (_isRecurrenceTzValid(chit.timezone)) {
      return chit.timezone;
    }
    // Unrecognized timezone: fall back to user's default/current timezone
    console.warn('[Recurrence] Unrecognized timezone "' + chit.timezone + '" for chit ' + chit.id + ', falling back to ' + currentTz);
    return currentTz || 'UTC';
  }
  // Floating chit: use user's current timezone
  return currentTz || 'UTC';
}

// ── Legacy Advancement (non-timezone-aware, kept for getRecurrenceSeriesInfo) ─

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
 * Timezone-aware: uses chit.timezone for anchored chits, _currentTimezone for floating.
 * Daily+ frequencies preserve wall-clock time across DST transitions.
 * Sub-daily frequencies (HOURLY/MINUTELY) maintain uniform elapsed-time intervals (UTC-based).
 * @param {object} chit - The chit to expand
 * @param {Date} rangeStart - Start of the visible date range
 * @param {Date} rangeEnd - End of the visible date range
 * @param {string} [currentTz] - User's current timezone (defaults to _currentTimezone global)
 */
function expandRecurrence(chit, rangeStart, rangeEnd, currentTz) {
  const rule = chit.recurrence_rule;
  if (!rule || !rule.freq) return [chit]; // not recurring, return as-is

  // Resolve timezone for expansion
  var tz = currentTz || (typeof _currentTimezone !== 'undefined' ? _currentTimezone : null) || 'UTC';
  var expansionTz = _resolveRecurrenceTz(chit, tz);

  const exceptions = chit.recurrence_exceptions || [];
  const exceptionDates = new Set(exceptions.map(e => e.date));
  const brokenOffDates = new Set(exceptions.filter(e => e.broken_off).map(e => e.date));
  const completedDates = new Set(exceptions.filter(e => e.completed).map(e => e.date));

  const info = getCalendarDateInfo(chit);
  if (!info.hasDate) return [chit];

  const freq = rule.freq;
  const interval = rule.interval || 1;
  const byDay = rule.byDay || [];
  const until = rule.until ? new Date(rule.until) : null;

  const dayMap = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };
  const byDayNums = byDay.map(d => dayMap[d]).filter(n => n !== undefined);

  const isSubDaily = freq === 'MINUTELY' || freq === 'HOURLY';

  // Parse the base datetime from the chit's stored value
  var baseIso = chit.start_datetime || chit.due_datetime || chit.point_in_time;
  var baseParts = _parseNaiveDatetime(baseIso);
  if (!baseParts) return [chit];

  // Compute duration in milliseconds (for generating end times)
  var durationMs = 0;
  if (!info.isAllDay && chit.start_datetime && chit.end_datetime) {
    var endParts = _parseNaiveDatetime(chit.end_datetime);
    if (endParts) {
      var startUtcMs = _wallClockToUtcMs(baseParts, expansionTz);
      var endUtcMs = _wallClockToUtcMs(endParts, expansionTz);
      durationMs = endUtcMs - startUtcMs;
    }
  }

  // For sub-daily: compute base UTC timestamp and advance by absolute duration
  var baseUtcMs = _wallClockToUtcMs(baseParts, expansionTz);

  // For daily+: track wall-clock parts and advance date components
  var currentParts = Object.assign({}, baseParts);

  const instances = [];
  const maxInstances = 365;
  let count = 0;
  let occurrenceNum = 0;

  while (count < maxInstances) {
    // Compute the UTC timestamp for the current occurrence
    var occUtcMs;
    if (isSubDaily) {
      // Sub-daily: uniform elapsed-time intervals from base UTC
      var delta = freq === 'HOURLY' ? (interval * 3600000) : (interval * 60000);
      occUtcMs = baseUtcMs + (delta * count);
    } else {
      // Daily+: convert current wall-clock parts to UTC in the expansion timezone
      occUtcMs = _wallClockToUtcMs(currentParts, expansionTz);
    }

    // Convert UTC timestamp to a local Date for range comparison and display
    // We display in the user's current timezone (tz), not the expansion timezone
    var displayParts = _utcMsToWallClock(occUtcMs, tz);
    var displayDate = new Date(displayParts.year, displayParts.month - 1, displayParts.day,
                               displayParts.hour, displayParts.minute, displayParts.second);

    // Check until condition (compare in expansion timezone wall-clock)
    if (until) {
      var untilParts = _parseNaiveDatetime(until.toISOString().replace('Z', ''));
      if (untilParts) {
        var untilUtcMs = _wallClockToUtcMs(untilParts, expansionTz);
        if (occUtcMs > untilUtcMs) break;
      } else if (displayDate > until) {
        break;
      }
    }

    if (displayDate > rangeEnd) break;

    // Generate the date string key for exceptions
    // For sub-daily, use datetime key; for daily+, use date key
    var occWallParts = _utcMsToWallClock(occUtcMs, expansionTz);
    var dateStr;
    if (isSubDaily) {
      dateStr = String(occWallParts.year) + '-' +
                String(occWallParts.month).padStart(2, '0') + '-' +
                String(occWallParts.day).padStart(2, '0') + 'T' +
                String(occWallParts.hour).padStart(2, '0') + ':' +
                String(occWallParts.minute).padStart(2, '0');
    } else {
      dateStr = String(occWallParts.year) + '-' +
                String(occWallParts.month).padStart(2, '0') + '-' +
                String(occWallParts.day).padStart(2, '0');
    }

    const inRange = displayDate >= rangeStart;

    // For weekly with byDay, check if current day matches
    let dayMatches = true;
    if (freq === 'WEEKLY' && byDayNums.length > 0) {
      // Use the wall-clock day in the expansion timezone
      var dayOfWeek = new Date(Date.UTC(occWallParts.year, occWallParts.month - 1, occWallParts.day)).getUTCDay();
      dayMatches = byDayNums.includes(dayOfWeek);
    }

    if (dayMatches && !brokenOffDates.has(dateStr)) {
      occurrenceNum++;
    }

    if (dayMatches && inRange && !brokenOffDates.has(dateStr)) {
      // Check for exception modifications
      const exception = exceptions.find(e => e.date === dateStr && !e.broken_off);

      // Compute virtual start/end as ISO strings in the display timezone
      var virtualStartIso = displayParts.year + '-' +
                            String(displayParts.month).padStart(2, '0') + '-' +
                            String(displayParts.day).padStart(2, '0') + 'T' +
                            String(displayParts.hour).padStart(2, '0') + ':' +
                            String(displayParts.minute).padStart(2, '0') + ':' +
                            String(displayParts.second).padStart(2, '0');

      var virtualEndIso = null;
      if (!info.isAllDay && durationMs > 0) {
        var endUtcMsOcc = occUtcMs + durationMs;
        var endDisplayParts = _utcMsToWallClock(endUtcMsOcc, tz);
        virtualEndIso = endDisplayParts.year + '-' +
                        String(endDisplayParts.month).padStart(2, '0') + '-' +
                        String(endDisplayParts.day).padStart(2, '0') + 'T' +
                        String(endDisplayParts.hour).padStart(2, '0') + ':' +
                        String(endDisplayParts.minute).padStart(2, '0') + ':' +
                        String(endDisplayParts.second).padStart(2, '0');
      }

      const instance = {
        ...chit,
        _isVirtual: true,
        _parentId: chit.id,
        _virtualDate: dateStr,
        _isCompleted: completedDates.has(dateStr),
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
          instance.start_datetime = virtualStartIso;
          instance.end_datetime = virtualEndIso || virtualStartIso;
        }
        if (exception.end_datetime) instance.end_datetime = exception.end_datetime;
        if (exception.due_datetime) instance.due_datetime = exception.due_datetime;
      } else {
        if (info.isDueOnly) {
          instance.due_datetime = virtualStartIso;
        } else {
          instance.start_datetime = virtualStartIso;
          instance.end_datetime = virtualEndIso || virtualStartIso;
        }
      }

      // Update the datetime objects for calendar rendering
      if (instance.start_datetime) instance.start_datetime_obj = new Date(instance.start_datetime);
      if (instance.end_datetime) instance.end_datetime_obj = new Date(instance.end_datetime);

      instances.push(instance);
    }

    // Advance to next occurrence
    count++;
    if (!isSubDaily) {
      // Daily+: advance wall-clock parts
      currentParts = _advanceWallClock(currentParts, freq, interval, byDayNums);
    }
  }

  return instances.length > 0 ? instances : [chit];
}

/**
 * Format a recurrence rule as a human-readable string.
 * @param {object} rule - { freq, interval, byDay, until }
 * @param {boolean} isHabit - If true, return simplified labels without day/date suffixes
 * @returns {string}
 */
function formatRecurrenceRule(rule, isHabit) {
  if (!rule || !rule.freq) return '';
  const freq = rule.freq;
  const interval = rule.interval || 1;
  const dayNames = { MO: 'Mon', TU: 'Tue', WE: 'Wed', TH: 'Thu', FR: 'Fri', SA: 'Sat', SU: 'Sun' };

  let text = '';
  if (freq === 'MINUTELY') text = interval === 1 ? 'Every minute' : `Every ${interval} minutes`;
  else if (freq === 'HOURLY') text = interval === 1 ? 'Hourly' : `Every ${interval} hours`;
  else if (freq === 'DAILY') text = interval === 1 ? 'Daily' : `Every ${interval} days`;
  else if (freq === 'WEEKLY') {
    text = interval === 1 ? `Weekly` : `Every ${interval} weeks`;
    if (!isHabit) {
      const days = (rule.byDay || []).map(d => dayNames[d] || d).join(', ');
      if (days) text += ` on ${days}`;
    }
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

