"""vCard and CSV serialization/deserialization for contacts.

Provides vcard_parse(), vcard_print(), csv_export(), csv_import(), and _csv_header().
"""

import csv
import io
from typing import List, Dict, Any

from src.backend.db import compute_display_name


def vcard_parse(vcard_string: str) -> dict:
    """Parse a vCard 3.0 string into a Contact dict.

    Maps standard vCard properties (N, FN, TEL, EMAIL, ADR, URL) and
    custom X-properties (X-SIGNAL, X-PGP-KEY, X-CALLSIGN, X-XHANDLE)
    to Contact model fields.  Returns a plain dict suitable for
    constructing a Contact Pydantic model.
    """
    contact: Dict[str, Any] = {
        "given_name": "",
        "surname": None,
        "middle_names": None,
        "prefix": None,
        "suffix": None,
        "phones": [],
        "emails": [],
        "addresses": [],
        "websites": [],
        "call_signs": [],
        "x_handles": [],
        "has_signal": False,
        "pgp_key": None,
        "favorite": False,
    }

    fn_value = None  # fallback display name from FN line

    # Unfold continuation lines (RFC 2425 §5.8.1): a line starting with
    # a space or tab is a continuation of the previous logical line.
    unfolded_lines: List[str] = []
    for raw_line in vcard_string.splitlines():
        if raw_line.startswith((" ", "\t")) and unfolded_lines:
            unfolded_lines[-1] += raw_line[1:]
        else:
            unfolded_lines.append(raw_line)

    for line in unfolded_lines:
        line = line.strip()
        if not line or line.upper() in ("BEGIN:VCARD", "END:VCARD", "VERSION:3.0"):
            continue

        # Split into property name (with params) and value
        colon_idx = line.find(":")
        if colon_idx == -1:
            continue
        prop_part = line[:colon_idx]
        value = line[colon_idx + 1:]

        # Parse property name and parameters (e.g. TEL;TYPE=Work)
        parts = prop_part.split(";")
        prop_name = parts[0].upper()
        params: Dict[str, str] = {}
        for p in parts[1:]:
            if "=" in p:
                pk, pv = p.split("=", 1)
                params[pk.upper()] = pv
            else:
                # Bare parameter (e.g. ";WORK") treated as TYPE
                params["TYPE"] = p

        label = params.get("TYPE", None)

        if prop_name == "N":
            # N:Surname;GivenName;MiddleNames;Prefix;Suffix
            n_parts = value.split(";")
            while len(n_parts) < 5:
                n_parts.append("")
            contact["surname"] = n_parts[0] if n_parts[0] else None
            contact["given_name"] = n_parts[1] if n_parts[1] else ""
            contact["middle_names"] = n_parts[2] if n_parts[2] else None
            contact["prefix"] = n_parts[3] if n_parts[3] else None
            contact["suffix"] = n_parts[4] if n_parts[4] else None

        elif prop_name == "FN":
            fn_value = value

        elif prop_name == "TEL":
            if value:
                contact["phones"].append({"label": label, "value": value})

        elif prop_name == "EMAIL":
            if value:
                contact["emails"].append({"label": label, "value": value})

        elif prop_name == "ADR":
            # ADR;TYPE=x:PO Box;Extended;Street;City;Region;PostalCode;Country
            if value:
                adr_parts = value.split(";")
                while len(adr_parts) < 7:
                    adr_parts.append("")
                # Build a human-readable address string, skipping empty parts
                formatted_parts = [p.strip() for p in adr_parts if p.strip()]
                formatted = ", ".join(formatted_parts)
                if formatted:
                    contact["addresses"].append({"label": label, "value": formatted})

        elif prop_name == "URL":
            if value:
                contact["websites"].append({"label": label, "value": value})

        elif prop_name == "X-SIGNAL":
            contact["has_signal"] = value.lower() in ("true", "1", "yes")

        elif prop_name == "X-PGP-KEY":
            contact["pgp_key"] = value if value else None

        elif prop_name == "X-CALLSIGN":
            if value:
                contact["call_signs"].append({"label": label, "value": value})

        elif prop_name == "X-XHANDLE":
            if value:
                contact["x_handles"].append({"label": label, "value": value})

        elif prop_name == "X-FAVORITE":
            contact["favorite"] = value.lower() in ("true", "1", "yes")

        elif prop_name == "BDAY":
            if value:
                # Normalize BDAY value — strip dashes if compact (e.g. 19900515 → 1990-05-15)
                bday_val = value.strip()
                if len(bday_val) == 8 and bday_val.isdigit():
                    bday_val = bday_val[:4] + '-' + bday_val[4:6] + '-' + bday_val[6:]
                if "dates" not in contact:
                    contact["dates"] = []
                contact["dates"].append({"label": "Birthday", "value": bday_val})

    # If given_name is still empty, try to extract from FN as a fallback
    if not contact["given_name"] and fn_value:
        contact["given_name"] = fn_value

    # Clean up empty multi-value lists → None for consistency
    for mv_field in ("phones", "emails", "addresses", "websites", "call_signs", "x_handles", "dates"):
        if not contact.get(mv_field):
            contact[mv_field] = None

    return contact


def vcard_print(contact) -> str:
    """Format a Contact (dict or Pydantic model) into a valid vCard 3.0 string.

    Handles all mapped properties including multi-value fields with TYPE
    parameters and custom X-properties.
    """

    def _get(field: str, default=None):
        if isinstance(contact, dict):
            return contact.get(field, default)
        return getattr(contact, field, default)

    lines: List[str] = []
    lines.append("BEGIN:VCARD")
    lines.append("VERSION:3.0")

    # N property
    surname = _get("surname") or ""
    given_name = _get("given_name") or ""
    middle_names = _get("middle_names") or ""
    prefix = _get("prefix") or ""
    suffix = _get("suffix") or ""
    lines.append(f"N:{surname};{given_name};{middle_names};{prefix};{suffix}")

    # FN property — computed display name
    display = _get("display_name")
    if not display:
        display = compute_display_name(contact)
    if display:
        lines.append(f"FN:{display}")

    # Multi-value fields helper
    def _add_multi(prop: str, field: str):
        entries = _get(field)
        if not entries:
            return
        for entry in entries:
            if isinstance(entry, dict):
                lbl = entry.get("label")
                val = entry.get("value") or ""
            else:
                lbl = getattr(entry, "label", None)
                val = getattr(entry, "value", None) or ""
            if not val:
                continue
            if lbl:
                lines.append(f"{prop};TYPE={lbl}:{val}")
            else:
                lines.append(f"{prop}:{val}")

    _add_multi("TEL", "phones")
    _add_multi("EMAIL", "emails")

    # ADR needs special handling — value is a formatted string, we store it
    # back in the street field of the structured ADR format
    addresses = _get("addresses")
    if addresses:
        for entry in addresses:
            if isinstance(entry, dict):
                lbl = entry.get("label")
                val = entry.get("value") or ""
            else:
                lbl = getattr(entry, "label", None)
                val = getattr(entry, "value", None) or ""
            if not val:
                continue
            # Put the full formatted address in the street field
            adr_value = f";;{val};;;;"
            if lbl:
                lines.append(f"ADR;TYPE={lbl}:{adr_value}")
            else:
                lines.append(f"ADR:{adr_value}")

    _add_multi("URL", "websites")

    # X-SIGNAL
    has_signal = _get("has_signal")
    if has_signal:
        lines.append("X-SIGNAL:true")

    # X-PGP-KEY
    pgp_key = _get("pgp_key")
    if pgp_key:
        lines.append(f"X-PGP-KEY:{pgp_key}")

    _add_multi("X-CALLSIGN", "call_signs")
    _add_multi("X-XHANDLE", "x_handles")

    # X-FAVORITE
    favorite = _get("favorite")
    if favorite:
        lines.append("X-FAVORITE:true")

    # BDAY — output birthday from dates array
    dates = _get("dates")
    if dates:
        for d in dates:
            if isinstance(d, dict):
                lbl = (d.get("label") or "").lower()
                val = d.get("value") or ""
            else:
                lbl = (getattr(d, "label", None) or "").lower()
                val = getattr(d, "value", None) or ""
            if lbl == "birthday" and val:
                lines.append(f"BDAY:{val}")
                break

    lines.append("END:VCARD")
    return "\r\n".join(lines)


# Multi-value field names that get flattened into numbered columns (up to 5 each)
_CSV_MULTI_VALUE_FIELDS = ["phones", "emails", "addresses", "call_signs", "x_handles", "websites"]
_CSV_MAX_MULTI = 5


def _csv_header() -> list:
    """Build the canonical CSV header row."""
    cols = ["given_name", "surname", "middle_names", "prefix", "suffix"]
    for field in _CSV_MULTI_VALUE_FIELDS:
        # Strip trailing 's' for column prefix (phones -> phone, addresses -> addresse -> address)
        col_prefix = field.rstrip("es") if field.endswith("sses") else (
            field.rstrip("s") if field.endswith("s") else field
        )
        # Nicer prefixes for known fields
        _prefix_map = {
            "phones": "phone",
            "emails": "email",
            "addresses": "address",
            "call_signs": "call_sign",
            "x_handles": "x_handle",
            "websites": "website",
        }
        col_prefix = _prefix_map.get(field, col_prefix)
        for i in range(1, _CSV_MAX_MULTI + 1):
            cols.append(f"{col_prefix}_{i}_label")
            cols.append(f"{col_prefix}_{i}_value")
    cols.extend(["has_signal", "pgp_key", "favorite"])
    return cols


def csv_export(contacts: list) -> str:
    """Flatten a list of Contact dicts/models into a CSV string with header row.

    Multi-value fields (phones, emails, etc.) are expanded into up to 5
    numbered column pairs: {type}_1_label, {type}_1_value, ...
    """
    header = _csv_header()
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(header)

    for contact in contacts:
        def _get(field, default=None):
            if isinstance(contact, dict):
                return contact.get(field, default)
            return getattr(contact, field, default)

        row = [
            _get("given_name") or "",
            _get("surname") or "",
            _get("middle_names") or "",
            _get("prefix") or "",
            _get("suffix") or "",
        ]

        for field in _CSV_MULTI_VALUE_FIELDS:
            entries = _get(field) or []
            for i in range(_CSV_MAX_MULTI):
                if i < len(entries):
                    entry = entries[i]
                    if isinstance(entry, dict):
                        row.append(entry.get("label") or "")
                        row.append(entry.get("value") or "")
                    else:
                        row.append(getattr(entry, "label", None) or "")
                        row.append(getattr(entry, "value", None) or "")
                else:
                    row.append("")
                    row.append("")

        row.append("true" if _get("has_signal") else "false")
        row.append(_get("pgp_key") or "")
        row.append("true" if _get("favorite") else "false")

        writer.writerow(row)

    return output.getvalue()


# Reverse mapping: column prefix -> Contact field name
_CSV_COL_PREFIX_TO_FIELD = {
    "phone": "phones",
    "email": "emails",
    "address": "addresses",
    "call_sign": "call_signs",
    "x_handle": "x_handles",
    "website": "websites",
}


def csv_import(csv_text: str) -> tuple:
    """Parse a CSV string back into a list of Contact dicts.

    Returns (contacts, errors) where errors is a list of
    {"row": <1-based row number>, "reason": "..."} dicts for skipped rows.
    """
    contacts = []
    errors = []

    reader = csv.DictReader(io.StringIO(csv_text))

    for row_idx, row in enumerate(reader, start=2):  # row 1 is header, data starts at 2
        given_name = (row.get("given_name") or "").strip()
        if not given_name:
            errors.append({"row": row_idx, "reason": "Missing given_name"})
            continue

        contact = {
            "given_name": given_name,
            "surname": (row.get("surname") or "").strip() or None,
            "middle_names": (row.get("middle_names") or "").strip() or None,
            "prefix": (row.get("prefix") or "").strip() or None,
            "suffix": (row.get("suffix") or "").strip() or None,
        }

        # Reconstruct multi-value fields from numbered columns
        for col_prefix, field_name in _CSV_COL_PREFIX_TO_FIELD.items():
            entries = []
            for i in range(1, _CSV_MAX_MULTI + 1):
                label_key = f"{col_prefix}_{i}_label"
                value_key = f"{col_prefix}_{i}_value"
                label = (row.get(label_key) or "").strip()
                value = (row.get(value_key) or "").strip()
                if value:
                    entries.append({"label": label or None, "value": value})
            contact[field_name] = entries if entries else None

        # Boolean / text fields
        has_signal_str = (row.get("has_signal") or "").strip().lower()
        contact["has_signal"] = has_signal_str in ("true", "1", "yes")

        contact["pgp_key"] = (row.get("pgp_key") or "").strip() or None

        fav_str = (row.get("favorite") or "").strip().lower()
        contact["favorite"] = fav_str in ("true", "1", "yes")

        contacts.append(contact)

    return (contacts, errors)
