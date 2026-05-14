"""Pure-Python cron expression parser for CWOC Rules Engine.

Parses standard 5-field cron expressions (minute hour day-of-month month
day-of-week) into sets of valid values, checks datetime matching, and
generates human-readable descriptions.

No external dependencies — uses only Python stdlib.
"""

import logging
from datetime import datetime
from typing import Dict, Optional, Set

logger = logging.getLogger(__name__)

# ── Name-to-number mappings ──────────────────────────────────────────

_DAY_NAMES = {
    "SUN": 0, "MON": 1, "TUE": 2, "WED": 3,
    "THU": 4, "FRI": 5, "SAT": 6,
}

_MONTH_NAMES = {
    "JAN": 1, "FEB": 2, "MAR": 3, "APR": 4,
    "MAY": 5, "JUN": 6, "JUL": 7, "AUG": 8,
    "SEP": 9, "OCT": 10, "NOV": 11, "DEC": 12,
}

# ── Field definitions (name, min, max, name_map) ─────────────────────

_FIELD_DEFS = [
    ("minutes", 0, 59, None),
    ("hours", 0, 23, None),
    ("days_of_month", 1, 31, None),
    ("months", 1, 12, _MONTH_NAMES),
    ("days_of_week", 0, 6, _DAY_NAMES),
]


# ── Internal parsing helpers ─────────────────────────────────────────

def _replace_names(token: str, name_map: Optional[Dict[str, int]]) -> str:
    """Replace named values (MON, JAN, etc.) with their numeric equivalents."""
    if not name_map:
        return token
    upper = token.upper()
    for name, num in name_map.items():
        upper = upper.replace(name, str(num))
    return upper


def _parse_field(token: str, min_val: int, max_val: int,
                 name_map: Optional[Dict[str, int]]) -> Optional[Set[int]]:
    """Parse a single cron field token into a set of valid integers.

    Supports: *, specific values, ranges (1-5), lists (1,3,5),
    step values (*/15, 1-30/5).

    Returns None if the token is invalid.
    """
    token = _replace_names(token.strip(), name_map)
    result = set()

    # Handle comma-separated lists
    parts = token.split(",")
    for part in parts:
        values = _parse_part(part, min_val, max_val)
        if values is None:
            return None
        result.update(values)

    return result


def _parse_part(part: str, min_val: int, max_val: int) -> Optional[Set[int]]:
    """Parse a single part of a cron field (no commas)."""
    # Check for step value
    step = None
    if "/" in part:
        pieces = part.split("/", 1)
        if len(pieces) != 2:
            return None
        part = pieces[0]
        try:
            step = int(pieces[1])
        except ValueError:
            return None
        if step <= 0:
            return None

    # Wildcard
    if part == "*":
        start, end = min_val, max_val
    # Range
    elif "-" in part:
        pieces = part.split("-", 1)
        if len(pieces) != 2:
            return None
        try:
            start = int(pieces[0])
            end = int(pieces[1])
        except ValueError:
            return None
        if start > end or start < min_val or end > max_val:
            return None
    # Single value
    else:
        try:
            val = int(part)
        except ValueError:
            return None
        if val < min_val or val > max_val:
            return None
        if step is not None:
            # e.g., 5/15 means starting at 5, every 15
            start, end = val, max_val
        else:
            return {val}

    # Generate values with optional step
    if step is None:
        return set(range(start, end + 1))
    else:
        return set(range(start, end + 1, step))


# ── Public API ───────────────────────────────────────────────────────

def parse_cron(expression: str) -> Optional[Dict[str, Set[int]]]:
    """Parse a 5-field cron expression into a structured dict.

    Args:
        expression: A standard 5-field cron string
                    (minute hour day-of-month month day-of-week)

    Returns:
        Dict with keys: minutes, hours, days_of_month, months, days_of_week
        Each value is a set of valid integers for that field.
        Returns None if the expression is invalid.
    """
    if not expression or not isinstance(expression, str):
        return None

    fields = expression.strip().split()
    if len(fields) != 5:
        logger.warning("Invalid cron expression (expected 5 fields): %r", expression)
        return None

    result = {}
    for i, (name, min_val, max_val, name_map) in enumerate(_FIELD_DEFS):
        parsed = _parse_field(fields[i], min_val, max_val, name_map)
        if parsed is None:
            logger.warning("Invalid cron field %s: %r", name, fields[i])
            return None
        result[name] = parsed

    return result


def matches(parsed: Optional[Dict[str, Set[int]]], dt: datetime) -> bool:
    """Check if a datetime matches a parsed cron expression.

    Args:
        parsed: Output from parse_cron(), or None.
        dt: The datetime to check against.

    Returns:
        True if the datetime's minute, hour, day, month, and day-of-week
        all fall within the parsed sets. False if parsed is None or invalid.
    """
    if not parsed or not isinstance(parsed, dict):
        return False

    try:
        # Python weekday: Monday=0 ... Sunday=6
        # Cron weekday: Sunday=0 ... Saturday=6
        # Convert Python weekday to cron weekday
        python_dow = dt.weekday()  # Mon=0, Tue=1, ..., Sun=6
        cron_dow = (python_dow + 1) % 7  # Sun=0, Mon=1, ..., Sat=6

        if dt.minute not in parsed.get("minutes", set()):
            return False
        if dt.hour not in parsed.get("hours", set()):
            return False
        if dt.day not in parsed.get("days_of_month", set()):
            return False
        if dt.month not in parsed.get("months", set()):
            return False
        if cron_dow not in parsed.get("days_of_week", set()):
            return False
        return True
    except (AttributeError, TypeError):
        return False


def describe(expression: str) -> str:
    """Return a human-readable description of a cron expression.

    Args:
        expression: A standard 5-field cron string.

    Returns:
        A human-readable string describing when the cron fires.
        Returns "Invalid cron expression" if unparseable.
    """
    parsed = parse_cron(expression)
    if parsed is None:
        return "Invalid cron expression"

    fields = expression.strip().split()
    minute_f, hour_f, dom_f, month_f, dow_f = fields

    # Try to match common patterns for friendly descriptions
    desc = _describe_common_patterns(minute_f, hour_f, dom_f, month_f, dow_f, parsed)
    if desc:
        return desc

    # Fallback: build a generic description
    return _describe_generic(parsed)


# ── Description helpers ──────────────────────────────────────────────

def _format_time(hour: int, minute: int) -> str:
    """Format hour and minute as human-readable time (12-hour with AM/PM)."""
    period = "AM" if hour < 12 else "PM"
    display_hour = hour % 12
    if display_hour == 0:
        display_hour = 12
    if minute == 0:
        return f"{display_hour}:{minute:02d} {period}"
    return f"{display_hour}:{minute:02d} {period}"


def _describe_common_patterns(minute_f, hour_f, dom_f, month_f, dow_f, parsed):
    """Try to match well-known cron patterns and return a friendly description."""
    minutes = parsed["minutes"]
    hours = parsed["hours"]
    days_of_month = parsed["days_of_month"]
    months = parsed["months"]
    days_of_week = parsed["days_of_week"]

    all_minutes = minutes == set(range(0, 60))
    all_hours = hours == set(range(0, 24))
    all_dom = days_of_month == set(range(1, 32))
    all_months = months == set(range(1, 13))
    all_dow = days_of_week == set(range(0, 7))

    single_minute = len(minutes) == 1
    single_hour = len(hours) == 1

    # Every minute: * * * * *
    if all_minutes and all_hours and all_dom and all_months and all_dow:
        return "Every minute"

    # Step minutes with all other fields wild: */N * * * *
    if all_hours and all_dom and all_months and all_dow and not all_minutes:
        if "/" in minute_f and hour_f == "*":
            step = minute_f.split("/")[-1]
            return f"Every {step} minutes"

    # Specific time, every day: M H * * *
    if single_minute and single_hour and all_dom and all_months and all_dow:
        h = next(iter(hours))
        m = next(iter(minutes))
        return f"Every day at {_format_time(h, m)}"

    # Specific time, weekdays only: M H * * 1-5 or MON-FRI
    if single_minute and single_hour and all_dom and all_months:
        if days_of_week == {1, 2, 3, 4, 5}:
            h = next(iter(hours))
            m = next(iter(minutes))
            return f"Every weekday at {_format_time(h, m)}"

    # Specific time, weekends only: M H * * 0,6
    if single_minute and single_hour and all_dom and all_months:
        if days_of_week == {0, 6}:
            h = next(iter(hours))
            m = next(iter(minutes))
            return f"Every weekend at {_format_time(h, m)}"

    # Every hour at specific minute: M * * * *
    if single_minute and all_hours and all_dom and all_months and all_dow:
        m = next(iter(minutes))
        if m == 0:
            return "Every hour"
        return f"Every hour at minute {m}"

    # First of month: M H 1 * *
    if single_minute and single_hour and days_of_month == {1} and all_months and all_dow:
        h = next(iter(hours))
        m = next(iter(minutes))
        return f"First of each month at {_format_time(h, m)}"

    # Specific day of week at specific time
    if single_minute and single_hour and all_dom and all_months and len(days_of_week) == 1:
        h = next(iter(hours))
        m = next(iter(minutes))
        dow = next(iter(days_of_week))
        day_names = ["Sunday", "Monday", "Tuesday", "Wednesday",
                     "Thursday", "Friday", "Saturday"]
        return f"Every {day_names[dow]} at {_format_time(h, m)}"

    return None


def _describe_generic(parsed):
    """Build a generic description from parsed cron fields."""
    parts = []

    minutes = parsed["minutes"]
    hours = parsed["hours"]
    days_of_month = parsed["days_of_month"]
    months = parsed["months"]
    days_of_week = parsed["days_of_week"]

    # Time description
    if len(minutes) == 1 and len(hours) == 1:
        h = next(iter(hours))
        m = next(iter(minutes))
        parts.append(f"At {_format_time(h, m)}")
    elif len(hours) == 1:
        h = next(iter(hours))
        parts.append(f"During hour {h}")
    elif minutes != set(range(0, 60)) or hours != set(range(0, 24)):
        parts.append(f"Minutes {_format_set(minutes)}, hours {_format_set(hours)}")

    # Day description
    if days_of_month != set(range(1, 32)):
        parts.append(f"on day(s) {_format_set(days_of_month)}")

    # Month description
    if months != set(range(1, 13)):
        month_names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                       "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
        named = [month_names[m - 1] for m in sorted(months)]
        parts.append(f"in {', '.join(named)}")

    # Day of week description
    if days_of_week != set(range(0, 7)):
        day_names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
        named = [day_names[d] for d in sorted(days_of_week)]
        parts.append(f"on {', '.join(named)}")

    return " ".join(parts) if parts else "Custom schedule"


def _format_set(values: Set[int]) -> str:
    """Format a set of integers as a compact string."""
    sorted_vals = sorted(values)
    if len(sorted_vals) <= 5:
        return ", ".join(str(v) for v in sorted_vals)
    return f"{sorted_vals[0]}-{sorted_vals[-1]}"
