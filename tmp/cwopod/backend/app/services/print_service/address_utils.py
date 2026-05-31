"""Address utilities: state normalization for print provider APIs."""

import logging

logger = logging.getLogger(__name__)

# US state/territory full name → 2-letter abbreviation
US_STATE_TO_ABBREV = {
    "alabama": "AL", "alaska": "AK", "american samoa": "AS", "arizona": "AZ",
    "arkansas": "AR", "california": "CA", "colorado": "CO", "connecticut": "CT",
    "delaware": "DE", "district of columbia": "DC", "florida": "FL", "georgia": "GA",
    "guam": "GU", "hawaii": "HI", "idaho": "ID", "illinois": "IL", "indiana": "IN",
    "iowa": "IA", "kansas": "KS", "kentucky": "KY", "louisiana": "LA", "maine": "ME",
    "marshall islands": "MH", "maryland": "MD", "massachusetts": "MA", "michigan": "MI",
    "micronesia": "FM", "minnesota": "MN", "mississippi": "MS", "missouri": "MO",
    "montana": "MT", "nebraska": "NE", "nevada": "NV", "new hampshire": "NH",
    "new jersey": "NJ", "new mexico": "NM", "new york": "NY", "north carolina": "NC",
    "north dakota": "ND", "northern mariana islands": "MP", "ohio": "OH", "oklahoma": "OK",
    "oregon": "OR", "palau": "PW", "pennsylvania": "PA", "puerto rico": "PR",
    "rhode island": "RI", "south carolina": "SC", "south dakota": "SD", "tennessee": "TN",
    "texas": "TX", "utah": "UT", "vermont": "VT", "virgin islands": "VI", "virginia": "VA",
    "washington": "WA", "west virginia": "WV", "wisconsin": "WI", "wyoming": "WY",
}


def normalize_state_code(state: str | None) -> str:
    """Convert a state name or abbreviation to a 2-letter code.

    Accepts full names (e.g. 'Montana' → 'MT') or already-abbreviated codes.
    Returns the original value if no match is found (for non-US addresses).
    """
    if not state:
        return ""
    state_stripped = state.strip()
    # Already a 2-letter code
    if len(state_stripped) == 2:
        return state_stripped.upper()
    # Try full name lookup
    abbrev = US_STATE_TO_ABBREV.get(state_stripped.lower())
    if abbrev:
        logger.debug("normalize_state_code: '%s' → '%s'", state_stripped, abbrev)
        return abbrev
    # Return as-is for non-US or unrecognized
    logger.debug("normalize_state_code: no match for '%s', returning as-is", state_stripped)
    return state_stripped
