"""iCalendar (.ics) parser and printer for CWOC calendar import/export.

Provides ics_parse() and ics_print() for round-tripping parsed component dicts,
and ics_export_chits() for exporting CWOC chit dicts to RFC 5545 iCalendar format
with full timezone support (VTIMEZONE components, TZID parameters).

Uses Python stdlib only — no external libraries.
"""

import re
from datetime import datetime, timedelta, timezone
from typing import List, Dict, Any, Optional
from zoneinfo import ZoneInfo


def _unfold_lines(text: str) -> List[str]:
    """RFC 5545 line unfolding: continuation lines starting with space/tab
    are appended to the previous logical line."""
    lines: List[str] = []
    for raw in text.replace('\r\n', '\n').replace('\r', '\n').splitlines():
        if raw.startswith((' ', '\t')) and lines:
            lines[-1] += raw[1:]
        else:
            lines.append(raw)
    return lines


def _parse_datetime(value: str, params: Dict[str, str]) -> dict:
    """Parse a DTSTART/DTEND/DUE value into a structured dict.

    Returns {"value": <iso_str>, "tzid": <str|None>, "all_day": <bool>}
    """
    tzid = params.get("TZID")
    raw = value.strip()

    # DATE only: 8 digits, e.g. 20250615
    if re.match(r'^\d{8}$', raw):
        iso = f"{raw[:4]}-{raw[4:6]}-{raw[6:8]}"
        return {"value": iso, "tzid": tzid, "all_day": True}

    # DATE-TIME: 20250615T100000 or 20250615T100000Z
    m = re.match(r'^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$', raw)
    if m:
        iso = f"{m.group(1)}-{m.group(2)}-{m.group(3)}T{m.group(4)}:{m.group(5)}:{m.group(6)}"
        if m.group(7) == 'Z':
            iso += 'Z'
            if not tzid:
                tzid = "UTC"
        return {"value": iso, "tzid": tzid, "all_day": False}

    # Fallback — return as-is
    return {"value": raw, "tzid": tzid, "all_day": False}


def _parse_rrule(value: str) -> dict:
    """Parse an RRULE value string into a structured dict.

    Example: FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE;UNTIL=20251231T235959Z
    Returns: {"freq": "WEEKLY", "interval": 2, "byday": ["MO","WE"], "until": "20251231T235959Z", "count": None}
    """
    result: Dict[str, Any] = {
        "freq": None,
        "interval": 1,
        "byday": None,
        "until": None,
        "count": None,
    }
    for part in value.split(';'):
        if '=' not in part:
            continue
        key, val = part.split('=', 1)
        key = key.strip().upper()
        val = val.strip()
        if key == "FREQ":
            result["freq"] = val.upper()
        elif key == "INTERVAL":
            try:
                result["interval"] = int(val)
            except ValueError:
                result["interval"] = 1
        elif key == "BYDAY":
            result["byday"] = [d.strip() for d in val.split(',')]
        elif key == "UNTIL":
            result["until"] = val
        elif key == "COUNT":
            try:
                result["count"] = int(val)
            except ValueError:
                pass
    return result


def _parse_property_line(line: str) -> tuple:
    """Parse a single iCalendar property line into (name, params_dict, value).

    Handles parameter parsing like DTSTART;TZID=America/New_York:20250615T100000
    """
    colon_idx = line.find(':')
    if colon_idx == -1:
        return (None, {}, line)

    prop_part = line[:colon_idx]
    value = line[colon_idx + 1:]

    parts = prop_part.split(';')
    prop_name = parts[0].upper()
    params: Dict[str, str] = {}
    for p in parts[1:]:
        if '=' in p:
            pk, pv = p.split('=', 1)
            params[pk.upper()] = pv
        else:
            params[p.upper()] = ""
    return (prop_name, params, value)


def _parse_component(lines: List[str], comp_type: str) -> dict:
    """Parse the property lines of a single VEVENT or VTODO component."""
    comp: Dict[str, Any] = {
        "type": comp_type,
        "summary": None,
        "dtstart": None,
        "dtstart_tzid": None,
        "dtend": None,
        "dtend_tzid": None,
        "due": None,
        "due_tzid": None,
        "description": None,
        "location": None,
        "categories": [],
        "priority": None,
        "uid": None,
        "rrule": None,
        "status": None,
        "all_day": False,
    }

    for line in lines:
        prop_name, params, value = _parse_property_line(line)
        if prop_name is None:
            continue

        if prop_name == "SUMMARY":
            comp["summary"] = value
        elif prop_name == "DESCRIPTION":
            comp["description"] = value
        elif prop_name == "LOCATION":
            comp["location"] = value
        elif prop_name == "UID":
            comp["uid"] = value
        elif prop_name == "STATUS":
            comp["status"] = value.upper()
        elif prop_name == "PRIORITY":
            try:
                comp["priority"] = int(value)
            except ValueError:
                pass
        elif prop_name == "CATEGORIES":
            # Categories can appear multiple times; each value is comma-separated
            cats = [c.strip() for c in value.split(',') if c.strip()]
            comp["categories"].extend(cats)
        elif prop_name == "DTSTART":
            dt = _parse_datetime(value, params)
            comp["dtstart"] = dt["value"]
            comp["dtstart_tzid"] = dt["tzid"]
            comp["all_day"] = dt["all_day"]
        elif prop_name == "DTEND":
            dt = _parse_datetime(value, params)
            comp["dtend"] = dt["value"]
            comp["dtend_tzid"] = dt["tzid"]
        elif prop_name == "DUE":
            dt = _parse_datetime(value, params)
            comp["due"] = dt["value"]
            comp["due_tzid"] = dt.get("tzid")
        elif prop_name == "RRULE":
            comp["rrule"] = _parse_rrule(value)
        elif prop_name == "TRANSP":
            comp["transp"] = value.upper()  # OPAQUE or TRANSPARENT

    return comp



def ics_parse(ics_text: str) -> dict:
    """Parse an iCalendar (.ics) file into structured component data.

    Returns a dict with:
        "components": list of parsed VEVENT/VTODO dicts
        "errors": list of error description strings

    Returns an error dict (with "error" key) if the content is not valid
    iCalendar data.
    """
    if not ics_text or not ics_text.strip():
        return {"error": "Empty content provided"}

    lines = _unfold_lines(ics_text)

    # Validate: must start with BEGIN:VCALENDAR (ignoring blank leading lines)
    found_vcalendar = False
    for line in lines:
        stripped = line.strip()
        if not stripped:
            continue
        if stripped.upper() == "BEGIN:VCALENDAR":
            found_vcalendar = True
        break

    if not found_vcalendar:
        return {"error": "Invalid iCalendar file: does not begin with BEGIN:VCALENDAR"}

    # Extract calendar-level properties (before first component)
    calendar_name: Optional[str] = None
    in_component = False
    for line in lines:
        stripped = line.strip()
        upper = stripped.upper()
        if upper.startswith("BEGIN:V") and upper != "BEGIN:VCALENDAR":
            in_component = True
            break
        if not in_component:
            prop_name, params, value = _parse_property_line(stripped)
            if prop_name == "X-WR-CALNAME":
                calendar_name = value.strip()

    # Extract VEVENT and VTODO blocks
    components: List[dict] = []
    errors: List[str] = []
    current_block: Optional[List[str]] = None
    current_type: Optional[str] = None
    nested_depth = 0  # track nested components like VALARM inside VEVENT
    comp_index = 0

    for line in lines:
        stripped = line.strip()
        upper = stripped.upper()

        if upper in ("BEGIN:VEVENT", "BEGIN:VTODO"):
            if current_block is not None:
                # Nested — shouldn't happen normally, but handle gracefully
                nested_depth += 1
                continue
            current_type = "VEVENT" if upper == "BEGIN:VEVENT" else "VTODO"
            current_block = []
            continue

        if upper in ("END:VEVENT", "END:VTODO"):
            if nested_depth > 0:
                nested_depth -= 1
                continue
            if current_block is not None and current_type is not None:
                comp = _parse_component(current_block, current_type)
                comp_index += 1
                if comp["summary"] is None:
                    errors.append(f"Component {comp_index}: Missing SUMMARY property")
                else:
                    components.append(comp)
                current_block = None
                current_type = None
            continue

        # Skip nested sub-components (VALARM, etc.)
        if upper.startswith("BEGIN:") and current_block is not None:
            nested_depth += 1
            continue
        if upper.startswith("END:") and nested_depth > 0:
            nested_depth -= 1
            continue

        if current_block is not None and nested_depth == 0:
            current_block.append(stripped)

    if not components and not errors:
        return {"error": "Invalid iCalendar file: no VEVENT or VTODO components found"}

    result = {"components": components, "errors": errors}
    if calendar_name:
        result["calendar_name"] = calendar_name
    return result


def ics_print(components: List[dict]) -> str:
    """Serialize a list of parsed component dicts back into valid iCalendar text.

    Wraps output in BEGIN:VCALENDAR / END:VCALENDAR with VERSION:2.0 and PRODID.
    """
    lines: List[str] = []
    lines.append("BEGIN:VCALENDAR")
    lines.append("VERSION:2.0")
    lines.append("PRODID:-//CWOC//EN")

    for comp in components:
        comp_type = comp.get("type", "VEVENT")
        lines.append(f"BEGIN:{comp_type}")

        # UID
        if comp.get("uid"):
            lines.append(f"UID:{comp['uid']}")

        # SUMMARY
        if comp.get("summary"):
            lines.append(f"SUMMARY:{comp['summary']}")

        # DESCRIPTION
        if comp.get("description"):
            lines.append(f"DESCRIPTION:{comp['description']}")

        # LOCATION
        if comp.get("location"):
            lines.append(f"LOCATION:{comp['location']}")

        # DTSTART
        if comp.get("dtstart"):
            dtstart_line = _format_dt_property("DTSTART", comp["dtstart"],
                                                comp.get("dtstart_tzid"),
                                                comp.get("all_day", False))
            lines.append(dtstart_line)

        # DTEND
        if comp.get("dtend"):
            dtend_line = _format_dt_property("DTEND", comp["dtend"],
                                              comp.get("dtend_tzid"),
                                              comp.get("all_day", False))
            lines.append(dtend_line)

        # DUE (VTODO)
        if comp.get("due"):
            due_line = _format_dt_property("DUE", comp["due"],
                                            comp.get("due_tzid"),
                                            comp.get("all_day", False))
            lines.append(due_line)

        # STATUS
        if comp.get("status"):
            lines.append(f"STATUS:{comp['status']}")

        # PRIORITY
        if comp.get("priority") is not None:
            lines.append(f"PRIORITY:{comp['priority']}")

        # CATEGORIES
        if comp.get("categories"):
            lines.append(f"CATEGORIES:{','.join(comp['categories'])}")

        # RRULE
        if comp.get("rrule"):
            rrule_str = _format_rrule(comp["rrule"])
            if rrule_str:
                lines.append(f"RRULE:{rrule_str}")

        # TRANSP (availability: busy/free)
        if comp.get("transp"):
            lines.append(f"TRANSP:{comp['transp']}")

        lines.append(f"END:{comp_type}")

    lines.append("END:VCALENDAR")
    return "\r\n".join(lines)


def _format_dt_property(prop_name: str, value: str, tzid: Optional[str], all_day: bool) -> str:
    """Format a datetime property (DTSTART, DTEND, DUE) for iCalendar output."""
    # Convert ISO back to iCalendar format
    ical_value = _iso_to_ical(value, all_day)

    if all_day:
        return f"{prop_name};VALUE=DATE:{ical_value}"
    elif tzid and tzid != "UTC":
        return f"{prop_name};TZID={tzid}:{ical_value}"
    elif tzid == "UTC" or value.endswith('Z'):
        # Ensure Z suffix for UTC
        if not ical_value.endswith('Z'):
            ical_value += 'Z'
        return f"{prop_name}:{ical_value}"
    else:
        return f"{prop_name}:{ical_value}"


def _iso_to_ical(iso_str: str, all_day: bool) -> str:
    """Convert an ISO date/datetime string back to iCalendar format.

    '2025-06-15' -> '20250615'
    '2025-06-15T10:00:00' -> '20250615T100000'
    '2025-06-15T10:00:00Z' -> '20250615T100000Z'
    """
    s = iso_str.strip()
    has_z = s.endswith('Z')
    s = s.rstrip('Z')

    if all_day:
        # Date only
        return s.replace('-', '')[:8]

    if 'T' in s:
        date_part, time_part = s.split('T', 1)
        date_compact = date_part.replace('-', '')
        time_compact = time_part.replace(':', '')
        result = f"{date_compact}T{time_compact}"
        if has_z:
            result += 'Z'
        return result

    # Date only fallback
    return s.replace('-', '')


def _format_rrule(rrule: dict) -> Optional[str]:
    """Serialize an RRULE dict back into RFC 5545 RRULE format string."""
    if not rrule or not rrule.get("freq"):
        return None

    parts = [f"FREQ={rrule['freq']}"]

    interval = rrule.get("interval", 1)
    if interval and interval != 1:
        parts.append(f"INTERVAL={interval}")

    if rrule.get("byday"):
        parts.append(f"BYDAY={','.join(rrule['byday'])}")

    if rrule.get("until"):
        parts.append(f"UNTIL={rrule['until']}")
    elif rrule.get("count"):
        parts.append(f"COUNT={rrule['count']}")

    return ";".join(parts)


# ── Chit Export with Timezone Support ────────────────────────────────────────


def _build_vtimezone(tz_name: str, year: int) -> str:
    """Generate a VTIMEZONE component for the given IANA timezone and year.

    Uses zoneinfo to determine standard/daylight transitions by probing
    UTC offsets hour-by-hour across the year. Returns empty string if
    timezone is invalid.

    Per RFC 5545, DTSTART in VTIMEZONE sub-components is the wall-clock
    time at which the transition takes effect (in the "from" offset).
    """
    try:
        tz = ZoneInfo(tz_name)
    except (KeyError, Exception):
        return ""

    # Probe each hour of the year to find DST transitions
    jan1 = datetime(year, 1, 1, tzinfo=timezone.utc)
    transitions = []
    prev_offset = None

    # Check every hour for 366 days (covers leap years)
    total_hours = 366 * 24
    for hour_offset in range(total_hours):
        dt_utc = jan1 + timedelta(hours=hour_offset)
        dt_local = dt_utc.astimezone(tz)
        current_offset = dt_local.utcoffset()

        if prev_offset is not None and current_offset != prev_offset:
            transitions.append({
                "dt_utc": dt_utc,
                "offset_from": prev_offset,
                "offset_to": current_offset,
            })
        prev_offset = current_offset

    # If no transitions found, this is a fixed-offset timezone
    if not transitions:
        # Emit a minimal VTIMEZONE with STANDARD only (fixed offset)
        dt_local = jan1.astimezone(tz)
        offset = dt_local.utcoffset()
        offset_str = _format_utc_offset(offset)
        lines = [
            "BEGIN:VTIMEZONE",
            f"TZID:{tz_name}",
            "BEGIN:STANDARD",
            f"DTSTART:{year}0101T000000",
            f"TZOFFSETFROM:{offset_str}",
            f"TZOFFSETTO:{offset_str}",
            "TZNAME:STD",
            "END:STANDARD",
            "END:VTIMEZONE",
        ]
        return "\r\n".join(lines)

    # Build VTIMEZONE with STANDARD and DAYLIGHT sub-components
    lines = [
        "BEGIN:VTIMEZONE",
        f"TZID:{tz_name}",
    ]

    for trans in transitions:
        offset_from = trans["offset_from"]
        offset_to = trans["offset_to"]

        # Determine if this is a transition TO daylight or TO standard
        if offset_to > offset_from:
            # Spring forward — entering daylight saving
            comp_type = "DAYLIGHT"
            tz_abbr = "DT"
        else:
            # Fall back — entering standard time
            comp_type = "STANDARD"
            tz_abbr = "ST"

        # DTSTART per RFC 5545: the wall-clock time of the transition
        # expressed in the "from" offset (the time just before the switch).
        # For spring-forward (2:00 AM -> 3:00 AM), DTSTART is the local
        # time when clocks change, which is the new time (3:00 AM in new offset).
        # Actually per RFC 5545 Section 3.6.5, DTSTART is the effective
        # date and local time at which the onset of the observance takes effect.
        # This is the wall-clock time in the NEW offset.
        dt_local = trans["dt_utc"].astimezone(tz)
        dtstart_str = dt_local.strftime("%Y%m%dT%H%M%S")

        lines.append(f"BEGIN:{comp_type}")
        lines.append(f"DTSTART:{dtstart_str}")
        lines.append(f"TZOFFSETFROM:{_format_utc_offset(offset_from)}")
        lines.append(f"TZOFFSETTO:{_format_utc_offset(offset_to)}")
        lines.append(f"TZNAME:{tz_abbr}")
        lines.append(f"END:{comp_type}")

    lines.append("END:VTIMEZONE")
    return "\r\n".join(lines)


def _format_utc_offset(offset: timedelta) -> str:
    """Format a timedelta UTC offset as +HHMM or -HHMM string."""
    total_seconds = int(offset.total_seconds())
    sign = "+" if total_seconds >= 0 else "-"
    total_seconds = abs(total_seconds)
    hours = total_seconds // 3600
    minutes = (total_seconds % 3600) // 60
    return f"{sign}{hours:02d}{minutes:02d}"


def _chit_to_ical_datetime(dt_str: str, all_day: bool) -> str:
    """Convert a chit datetime string to iCalendar format.

    Input: '2025-06-15T10:00:00' or '2025-06-15'
    Output: '20250615T100000' or '20250615'
    """
    if not dt_str:
        return ""
    s = dt_str.strip().rstrip('Z')

    if all_day:
        # Extract date portion only
        return s[:10].replace('-', '')

    if 'T' in s:
        date_part, time_part = s.split('T', 1)
        date_compact = date_part.replace('-', '')
        time_compact = time_part.replace(':', '').replace('.', '')[:6]
        # Ensure exactly 6 digits for time
        time_compact = time_compact.ljust(6, '0')
        return f"{date_compact}T{time_compact}"

    # Date only
    return s.replace('-', '')[:8]


def _format_chit_rrule(recurrence_rule: dict) -> Optional[str]:
    """Serialize a CWOC recurrence_rule dict to RFC 5545 RRULE string.

    CWOC uses: { freq, interval, byDay, until, count }
    RFC 5545 uses: FREQ=DAILY;INTERVAL=2;BYDAY=MO,WE;UNTIL=20251231T235959Z
    """
    if not recurrence_rule or not recurrence_rule.get("freq"):
        return None

    parts = [f"FREQ={recurrence_rule['freq']}"]

    interval = recurrence_rule.get("interval", 1)
    if interval and interval != 1:
        parts.append(f"INTERVAL={interval}")

    by_day = recurrence_rule.get("byDay") or recurrence_rule.get("byday")
    if by_day:
        if isinstance(by_day, list):
            parts.append(f"BYDAY={','.join(by_day)}")
        else:
            parts.append(f"BYDAY={by_day}")

    until = recurrence_rule.get("until")
    count = recurrence_rule.get("count")
    if until:
        # Convert ISO to iCal format if needed
        until_str = until.replace('-', '').replace(':', '')
        if 'T' not in until_str and len(until_str) == 8:
            until_str += "T235959Z"
        parts.append(f"UNTIL={until_str}")
    elif count:
        parts.append(f"COUNT={count}")

    return ";".join(parts)


def _format_exdates(exceptions: List[Dict[str, Any]], tz_name: Optional[str], all_day: bool) -> List[str]:
    """Format recurrence exceptions as EXDATE lines.

    Returns a list of EXDATE property lines.
    """
    if not exceptions:
        return []

    lines = []
    for exc in exceptions:
        date_val = exc.get("date")
        if not date_val:
            continue

        if all_day:
            # All-day: EXDATE;VALUE=DATE:YYYYMMDD
            ical_date = date_val.replace('-', '')[:8]
            lines.append(f"EXDATE;VALUE=DATE:{ical_date}")
        elif tz_name:
            # Anchored: EXDATE;TZID=...:YYYYMMDDTHHMMSS
            # Exception dates are stored as YYYY-MM-DD; assume start of day
            ical_date = date_val.replace('-', '')[:8] + "T000000"
            lines.append(f"EXDATE;TZID={tz_name}:{ical_date}")
        else:
            # Floating: EXDATE:YYYYMMDDTHHMMSS (no TZID, no Z)
            ical_date = date_val.replace('-', '')[:8] + "T000000"
            lines.append(f"EXDATE:{ical_date}")

    return lines


def ics_export_chits(chits: List[dict]) -> str:
    """Export a list of chit dicts to RFC 5545 iCalendar format.

    - Anchored chits: DTSTART;TZID=..., VTIMEZONE component included
    - Floating chits: DTSTART with naive local time (no TZID, no Z)
    - All-day chits: DTSTART;VALUE=DATE:YYYYMMDD
    - Chits without start_datetime or due_datetime: omitted
    - One VTIMEZONE per unique timezone referenced
    - Anchored chits with recurrence: RRULE and EXDATE with TZID context
    - Conforms to RFC 5545 (VCALENDAR wrapper, VERSION:2.0)
    """
    # Collect unique timezones and determine the year for VTIMEZONE generation
    timezones_used: Dict[str, int] = {}  # tz_name -> year (from first chit using it)
    exportable_chits: List[dict] = []

    for chit in chits:
        # Skip chits with no start_datetime and no due_datetime
        start_dt = chit.get("start_datetime")
        due_dt = chit.get("due_datetime")
        if not start_dt and not due_dt:
            continue

        exportable_chits.append(chit)

        # Track timezone usage
        tz_name = chit.get("timezone")
        if tz_name:
            if tz_name not in timezones_used:
                # Determine year from the chit's start or due datetime
                ref_dt = start_dt or due_dt
                try:
                    year = int(ref_dt[:4])
                except (ValueError, TypeError):
                    year = datetime.now().year
                timezones_used[tz_name] = year

    # Build output
    lines: List[str] = []
    lines.append("BEGIN:VCALENDAR")
    lines.append("VERSION:2.0")
    lines.append("PRODID:-//CWOC//EN")

    # Emit one VTIMEZONE per unique timezone
    for tz_name, year in timezones_used.items():
        vtimezone = _build_vtimezone(tz_name, year)
        if vtimezone:
            lines.append(vtimezone)

    # Emit VEVENTs for each exportable chit
    for chit in exportable_chits:
        is_all_day = bool(chit.get("all_day"))
        tz_name = chit.get("timezone")
        start_dt = chit.get("start_datetime")
        end_dt = chit.get("end_datetime")
        due_dt = chit.get("due_datetime")

        lines.append("BEGIN:VEVENT")

        # UID
        chit_id = chit.get("id", "")
        if chit_id:
            lines.append(f"UID:{chit_id}@cwoc")

        # SUMMARY
        title = chit.get("title") or "Untitled"
        lines.append(f"SUMMARY:{title}")

        # DESCRIPTION (from note field)
        note = chit.get("note")
        if note:
            # Escape newlines and special chars per RFC 5545
            escaped_note = note.replace('\\', '\\\\').replace('\n', '\\n').replace(',', '\\,').replace(';', '\\;')
            lines.append(f"DESCRIPTION:{escaped_note}")

        # LOCATION
        location = chit.get("location")
        if location:
            lines.append(f"LOCATION:{location}")

        # DTSTART
        if start_dt:
            if is_all_day:
                ical_val = _chit_to_ical_datetime(start_dt, True)
                lines.append(f"DTSTART;VALUE=DATE:{ical_val}")
            elif tz_name:
                ical_val = _chit_to_ical_datetime(start_dt, False)
                lines.append(f"DTSTART;TZID={tz_name}:{ical_val}")
            else:
                # Floating: naive local time, no TZID, no Z
                ical_val = _chit_to_ical_datetime(start_dt, False)
                lines.append(f"DTSTART:{ical_val}")
        elif due_dt:
            # Use due_datetime as DTSTART if no start_datetime
            if is_all_day:
                ical_val = _chit_to_ical_datetime(due_dt, True)
                lines.append(f"DTSTART;VALUE=DATE:{ical_val}")
            elif tz_name:
                ical_val = _chit_to_ical_datetime(due_dt, False)
                lines.append(f"DTSTART;TZID={tz_name}:{ical_val}")
            else:
                ical_val = _chit_to_ical_datetime(due_dt, False)
                lines.append(f"DTSTART:{ical_val}")

        # DTEND
        if end_dt:
            if is_all_day:
                ical_val = _chit_to_ical_datetime(end_dt, True)
                lines.append(f"DTEND;VALUE=DATE:{ical_val}")
            elif tz_name:
                ical_val = _chit_to_ical_datetime(end_dt, False)
                lines.append(f"DTEND;TZID={tz_name}:{ical_val}")
            else:
                ical_val = _chit_to_ical_datetime(end_dt, False)
                lines.append(f"DTEND:{ical_val}")

        # DUE (if different from start and present)
        if due_dt and start_dt:
            if is_all_day:
                ical_val = _chit_to_ical_datetime(due_dt, True)
                lines.append(f"DUE;VALUE=DATE:{ical_val}")
            elif tz_name:
                ical_val = _chit_to_ical_datetime(due_dt, False)
                lines.append(f"DUE;TZID={tz_name}:{ical_val}")
            else:
                ical_val = _chit_to_ical_datetime(due_dt, False)
                lines.append(f"DUE:{ical_val}")

        # STATUS
        status = chit.get("status")
        if status:
            # Map CWOC statuses to iCal statuses
            status_map = {
                "Complete": "COMPLETED",
                "In Progress": "IN-PROCESS",
                "Blocked": "IN-PROCESS",
                "ToDo": "NEEDS-ACTION",
            }
            ical_status = status_map.get(status, status.upper())
            lines.append(f"STATUS:{ical_status}")

        # CATEGORIES (from tags)
        tags = chit.get("tags")
        if tags and isinstance(tags, list) and len(tags) > 0:
            lines.append(f"CATEGORIES:{','.join(tags)}")

        # RRULE
        recurrence_rule = chit.get("recurrence_rule")
        if recurrence_rule:
            rrule_str = _format_chit_rrule(recurrence_rule)
            if rrule_str:
                lines.append(f"RRULE:{rrule_str}")

            # EXDATE (recurrence exceptions)
            recurrence_exceptions = chit.get("recurrence_exceptions")
            if recurrence_exceptions:
                exdate_lines = _format_exdates(recurrence_exceptions, tz_name, is_all_day)
                lines.extend(exdate_lines)

        lines.append("END:VEVENT")

    lines.append("END:VCALENDAR")
    return "\r\n".join(lines)
