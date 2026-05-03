"""iCalendar (.ics) parser and printer for CWOC calendar import.

Provides ics_parse() and ics_print() following the same architectural
pattern as the vCard serializer in serializers.py.  Uses Python stdlib
only — no external libraries.
"""

import re
from typing import List, Dict, Any, Optional


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

    return {"components": components, "errors": errors}


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
