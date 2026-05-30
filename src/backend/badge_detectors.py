"""
badge_detectors.py — Python port of the smart link detector registry.

Ported from src/frontend/js/shared/shared-smart-links.js.
Scans email text (subject + body_text + from) for recognizable patterns
(tracking numbers, flight numbers, hotel confirmations, rental cars, events,
restaurants, transit, orders) and returns actionable badge matches.

Architecture:
  - A registry of "detectors" — each defines keywords, regex patterns, and
    a URL template. Detectors are grouped by category.
  - `detect_badges(chit, settings)` runs all enabled detectors against the
    chit text and returns a list of match dicts.
  - Respects user's smart_actions_config for disabled detectors/categories
    and custom detectors.
  - Deduplication: returns unique (provider_name, code) pairs for UPSERT.

Depends on: re (stdlib only)
"""

import re
import json
from urllib.parse import quote as _url_quote


# ═══════════════════════════════════════════════════════════════════════════
# Smart Link Registry
# ═══════════════════════════════════════════════════════════════════════════

# Each detector entry:
#   category  — grouping label (Package, Flight, Hotel, Rental, Event, Restaurant, Transit, Order)
#   name      — display name (e.g. "UPS", "Marriott")
#   icon      — path to SVG icon (relative to /static/tracking/)
#   keywords  — list of compiled regex patterns that must be present in text (OR logic)
#               None means "always try the regex" (for format-unique patterns like 1Z...)
#   regex     — compiled regex to extract the actionable code/number. First capture group is used.
#   url       — URL template. {code} is replaced with the matched value.
#   label     — button label text (e.g. "Track", "Manage", "View")
#   priority  — lower = checked first within category (default 10)
#   extract   — optional callable(match) -> code string (for multi-group extraction)

BUILT_IN_DETECTORS = [

    # ─── Package Tracking ────────────────────────────────────────────────────

    {
        "category": "Package",
        "name": "UPS",
        "icon": "/static/tracking/ups.svg",
        "keywords": None,  # 1Z format is unique enough
        "regex": re.compile(r"\b(1Z[0-9A-Z]{16})\b", re.IGNORECASE),
        "url": "https://www.ups.com/track?tracknum={code}",
        "label": "Track",
        "priority": 1,
    },
    {
        "category": "Package",
        "name": "FedEx",
        "icon": "/static/tracking/fedex.svg",
        "keywords": [re.compile(r"\b(fedex|fed\s*ex|federal\s*express)\b", re.IGNORECASE)],
        "regex": re.compile(r"\b(\d{12}|\d{15}|\d{20}|\d{22})\b"),
        "url": "https://www.fedex.com/fedextrack/?trknbr={code}",
        "label": "Track",
        "priority": 2,
    },
    {
        "category": "Package",
        "name": "USPS",
        "icon": "/static/tracking/usps.svg",
        "keywords": [
            re.compile(r"\b(usps|postal\s*service|united\s*states\s*postal)\b", re.IGNORECASE),
            re.compile(r"\b(tracking|shipment|delivered|delivery|package)\b", re.IGNORECASE),
        ],
        "regex": re.compile(r"\b(\d{20,22})\b"),
        "url": "https://tools.usps.com/go/TrackConfirmAction?tLabels={code}",
        "label": "Track",
        "priority": 3,
    },
    {
        "category": "Package",
        "name": "USPS Intl",
        "icon": "/static/tracking/usps.svg",
        "keywords": None,
        "regex": re.compile(r"\b([A-Z]{2}\d{9}[A-Z]{2})\b"),
        "url": "https://tools.usps.com/go/TrackConfirmAction?tLabels={code}",
        "label": "Track",
        "priority": 4,
    },
    {
        "category": "Package",
        "name": "DHL",
        "icon": "/static/tracking/dhl.svg",
        "keywords": [re.compile(r"\b(dhl|deutsche\s*post)\b", re.IGNORECASE)],
        "regex": re.compile(r"\b(\d{10,11})\b"),
        "url": "https://www.dhl.com/us-en/home/tracking/tracking-parcel.html?submit=1&tracking-id={code}",
        "label": "Track",
        "priority": 5,
    },
    {
        "category": "Package",
        "name": "Amazon",
        "icon": "/static/tracking/amazon.svg",
        "keywords": [re.compile(r"\b(amazon|amzn)\b", re.IGNORECASE)],
        "regex": re.compile(r"\b(TBA\d{12,15})\b", re.IGNORECASE),
        "url": "https://www.amazon.com/gp/your-account/order-history?search={code}",
        "label": "Track",
        "priority": 6,
    },
    {
        "category": "Package",
        "name": "UniUni",
        "icon": "/static/tracking/uniuni.svg",
        "keywords": None,
        "regex": re.compile(r"\b(UU[A-Z0-9]{8,18})\b", re.IGNORECASE),
        "url": "https://www.uniuni.com/en/tracking?tracking_id={code}",
        "label": "Track",
        "priority": 7,
    },
    {
        "category": "Package",
        "name": "OnTrac",
        "icon": "/static/tracking/ontrac.svg",
        "keywords": [re.compile(r"\b(ontrac|on\s*trac)\b", re.IGNORECASE)],
        "regex": re.compile(r"\b(C\d{14})\b", re.IGNORECASE),
        "url": "https://www.ontrac.com/tracking/?number={code}",
        "label": "Track",
        "priority": 8,
    },
    {
        "category": "Package",
        "name": "LaserShip",
        "icon": "/static/tracking/lasership.svg",
        "keywords": [re.compile(r"\b(lasership|laser\s*ship)\b", re.IGNORECASE)],
        "regex": re.compile(r"\b(L[A-Z]\d{8,14})\b", re.IGNORECASE),
        "url": "https://www.lasership.com/track/{code}",
        "label": "Track",
        "priority": 9,
    },

    # ─── Flights ─────────────────────────────────────────────────────────────

    {
        "category": "Flight",
        "name": "Flight",
        "icon": "/static/tracking/flight.svg",
        "keywords": [re.compile(r"\b(flight|depart|arriv|board|gate|terminal|itinerary|booking|airline|boarding\s*pass)\b", re.IGNORECASE)],
        "regex": re.compile(r"\b([A-Z]{2}|[A-Z]\d|\d[A-Z])\s?(\d{1,4})\b"),
        "url": "https://www.flightradar24.com/{code}",
        "label": "Flight",
        "priority": 1,
        "extract": lambda m: (m.group(1) + m.group(2)).upper(),
    },

    # ─── Hotels ──────────────────────────────────────────────────────────────

    {
        "category": "Hotel",
        "name": "Marriott",
        "icon": "/static/tracking/hotel.svg",
        "keywords": [re.compile(r"\b(marriott|bonvoy|sheraton|westin|w\s*hotel|courtyard|fairfield|springhill|residence\s*inn|towneplace|aloft|element|moxy|le\s*meridien|st\.?\s*regis|ritz.carlton)\b", re.IGNORECASE)],
        "regex": re.compile(r"\b(\d{8,9})\b"),
        "url": "https://www.marriott.com/reservation/lookUpConfirmation.mi",
        "label": "Manage",
        "priority": 1,
    },
    {
        "category": "Hotel",
        "name": "Hilton",
        "icon": "/static/tracking/hotel.svg",
        "keywords": [re.compile(r"\b(hilton|hampton\s*inn|doubletree|embassy\s*suites|homewood\s*suites|home2|waldorf|conrad|canopy|curio|tapestry|tempo|motto|lxr)\b", re.IGNORECASE)],
        "regex": re.compile(r"\b(\d{8,10})\b"),
        "url": "https://www.hilton.com/en/book/reservation/find/",
        "label": "Manage",
        "priority": 2,
    },
    {
        "category": "Hotel",
        "name": "IHG",
        "icon": "/static/tracking/hotel.svg",
        "keywords": [re.compile(r"\b(ihg|holiday\s*inn|crowne\s*plaza|intercontinental|indigo|candlewood|staybridge|even\s*hotel|avid\s*hotel|atwell|vignette|kimpton)\b", re.IGNORECASE)],
        "regex": re.compile(r"\b(\d{8,11})\b"),
        "url": "https://www.ihg.com/hotels/us/en/find-hotels/hotel/rooms",
        "label": "Manage",
        "priority": 3,
    },
    {
        "category": "Hotel",
        "name": "Hyatt",
        "icon": "/static/tracking/hotel.svg",
        "keywords": [re.compile(r"\b(hyatt|park\s*hyatt|grand\s*hyatt|andaz|thompson|alila|caption|hyatt\s*place|hyatt\s*house)\b", re.IGNORECASE)],
        "regex": re.compile(r"\b([A-Z0-9]{6,12})\b"),
        "url": "https://www.hyatt.com/en-US/member/my-trips",
        "label": "Manage",
        "priority": 4,
    },
    {
        "category": "Hotel",
        "name": "Airbnb",
        "icon": "/static/tracking/airbnb.svg",
        "keywords": [re.compile(r"\b(airbnb)\b", re.IGNORECASE)],
        "regex": re.compile(r"\b(HM[A-Z0-9]{6,12}|[A-Z0-9]{10,12})\b"),
        "url": "https://www.airbnb.com/trips/v1",
        "label": "View",
        "priority": 5,
    },
    {
        "category": "Hotel",
        "name": "Booking.com",
        "icon": "/static/tracking/hotel.svg",
        "keywords": [re.compile(r"\b(booking\.com)\b", re.IGNORECASE)],
        "regex": re.compile(r"\b(\d{7,12})\b"),
        "url": "https://secure.booking.com/myreservations.html",
        "label": "Manage",
        "priority": 6,
    },
    {
        "category": "Hotel",
        "name": "VRBO",
        "icon": "/static/tracking/hotel.svg",
        "keywords": [re.compile(r"\b(vrbo|homeaway)\b", re.IGNORECASE)],
        "regex": re.compile(r"\b(HA-[A-Z0-9]{6,10}|[A-Z0-9]{8,12})\b"),
        "url": "https://www.vrbo.com/trips",
        "label": "View",
        "priority": 7,
    },
    {
        "category": "Hotel",
        "name": "Wyndham",
        "icon": "/static/tracking/hotel.svg",
        "keywords": [re.compile(r"\b(wyndham|days\s*inn|super\s*8|ramada|la\s*quinta|wingate|baymont|microtel|hawthorn|tryp|dolce)\b", re.IGNORECASE)],
        "regex": re.compile(r"\b(\d{8,12})\b"),
        "url": "https://www.wyndhamhotels.com/wyndham-rewards/member/reservations",
        "label": "Manage",
        "priority": 8,
    },

    # ─── Rental Cars ─────────────────────────────────────────────────────────

    {
        "category": "Rental",
        "name": "Enterprise",
        "icon": "/static/tracking/rental.svg",
        "keywords": [re.compile(r"\b(enterprise|national\s*car|alamo)\b", re.IGNORECASE)],
        "regex": re.compile(r"\b([A-Z0-9]{7,12})\b"),
        "url": "https://www.enterprise.com/en/reserve/view-modify-cancel.html",
        "label": "Manage",
        "priority": 1,
    },
    {
        "category": "Rental",
        "name": "Hertz",
        "icon": "/static/tracking/rental.svg",
        "keywords": [re.compile(r"\b(hertz|dollar\s*car|thrifty)\b", re.IGNORECASE)],
        "regex": re.compile(r"\b([A-Z]\d{8,10})\b"),
        "url": "https://www.hertz.com/rentacar/receipts/request-receipts.do",
        "label": "Manage",
        "priority": 2,
    },
    {
        "category": "Rental",
        "name": "Avis/Budget",
        "icon": "/static/tracking/rental.svg",
        "keywords": [re.compile(r"\b(avis|budget\s*car|budget\s*rent)\b", re.IGNORECASE)],
        "regex": re.compile(r"\b([A-Z0-9]{8,12})\b"),
        "url": "https://www.avis.com/en/reservation/view-modify-cancel",
        "label": "Manage",
        "priority": 3,
    },
    {
        "category": "Rental",
        "name": "Turo",
        "icon": "/static/tracking/rental.svg",
        "keywords": [re.compile(r"\b(turo)\b", re.IGNORECASE)],
        "regex": re.compile(r"\b([A-Z0-9]{6,12})\b"),
        "url": "https://turo.com/trips",
        "label": "View",
        "priority": 4,
    },

    # ─── Events & Tickets ────────────────────────────────────────────────────

    {
        "category": "Event",
        "name": "Ticketmaster",
        "icon": "/static/tracking/event.svg",
        "keywords": [re.compile(r"\b(ticketmaster|livenation|live\s*nation)\b", re.IGNORECASE)],
        "regex": re.compile(r"\b(\d{2}-\d{5}-\d{7}|\d{13,16})\b"),
        "url": "https://www.ticketmaster.com/member/orders",
        "label": "Tickets",
        "priority": 1,
    },
    {
        "category": "Event",
        "name": "Eventbrite",
        "icon": "/static/tracking/event.svg",
        "keywords": [re.compile(r"\b(eventbrite)\b", re.IGNORECASE)],
        "regex": re.compile(r"\b(\d{10,12})\b"),
        "url": "https://www.eventbrite.com/mytickets/",
        "label": "Tickets",
        "priority": 2,
    },
    {
        "category": "Event",
        "name": "AXS",
        "icon": "/static/tracking/event.svg",
        "keywords": [re.compile(r"\b(axs\.com|axs\s*tickets)\b", re.IGNORECASE)],
        "regex": re.compile(r"\b([A-Z0-9]{8,14})\b"),
        "url": "https://www.axs.com/orders",
        "label": "Tickets",
        "priority": 3,
    },
    {
        "category": "Event",
        "name": "StubHub",
        "icon": "/static/tracking/event.svg",
        "keywords": [re.compile(r"\b(stubhub)\b", re.IGNORECASE)],
        "regex": re.compile(r"\b(\d{8,12})\b"),
        "url": "https://www.stubhub.com/my/orders",
        "label": "Tickets",
        "priority": 4,
    },
    {
        "category": "Event",
        "name": "SeatGeek",
        "icon": "/static/tracking/event.svg",
        "keywords": [re.compile(r"\b(seatgeek)\b", re.IGNORECASE)],
        "regex": re.compile(r"\b([A-Z0-9]{6,12})\b"),
        "url": "https://seatgeek.com/orders",
        "label": "Tickets",
        "priority": 5,
    },

    # ─── Restaurants ─────────────────────────────────────────────────────────

    {
        "category": "Restaurant",
        "name": "OpenTable",
        "icon": "/static/tracking/restaurant.svg",
        "keywords": [re.compile(r"\b(opentable)\b", re.IGNORECASE)],
        "regex": re.compile(r"\b([A-Z0-9]{8,14})\b"),
        "url": "https://www.opentable.com/my/reservations",
        "label": "View",
        "priority": 1,
    },
    {
        "category": "Restaurant",
        "name": "Resy",
        "icon": "/static/tracking/restaurant.svg",
        "keywords": [re.compile(r"\b(resy)\b", re.IGNORECASE)],
        "regex": re.compile(r"\b([A-Z0-9]{6,12})\b"),
        "url": "https://resy.com/account/reservations",
        "label": "View",
        "priority": 2,
    },

    # ─── Rideshare & Transit ─────────────────────────────────────────────────

    {
        "category": "Transit",
        "name": "Uber",
        "icon": "/static/tracking/transit.svg",
        "keywords": [
            re.compile(r"\b(uber)\b", re.IGNORECASE),
            re.compile(r"\b(trip\s*receipt|ride\s*receipt)\b", re.IGNORECASE),
        ],
        "regex": re.compile(r"\b([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})\b", re.IGNORECASE),
        "url": "https://riders.uber.com/trips",
        "label": "View",
        "priority": 1,
    },
    {
        "category": "Transit",
        "name": "Lyft",
        "icon": "/static/tracking/transit.svg",
        "keywords": [re.compile(r"\b(lyft)\b", re.IGNORECASE)],
        "regex": re.compile(r"\b([A-Z0-9]{8,14})\b"),
        "url": "https://www.lyft.com/ride-history",
        "label": "View",
        "priority": 2,
    },

    # ─── Orders & Confirmations ──────────────────────────────────────────────

    {
        "category": "Order",
        "name": "Amazon Order",
        "icon": "/static/tracking/order.svg",
        "keywords": [
            re.compile(r"\b(amazon\.com|amzn\.com)\b", re.IGNORECASE),
            re.compile(r"\b(amazon|amzn)\s+(order|shipment|delivery)\b", re.IGNORECASE),
        ],
        "regex": re.compile(r"\b(\d{3}-\d{7}-\d{7})\b"),
        "url": "https://www.amazon.com/gp/your-account/order-history?search={code}",
        "label": "Order",
        "priority": 1,
    },
    {
        "category": "Order",
        "name": "Apple Order",
        "icon": "/static/tracking/order.svg",
        "keywords": [
            re.compile(r"\b(apple\.com)\b", re.IGNORECASE),
            re.compile(r"\b(apple\s+store|apple\s+order|apple\s+receipt)\b", re.IGNORECASE),
        ],
        "regex": re.compile(r"\b(W\d{9,12})\b", re.IGNORECASE),
        "url": "https://store.apple.com/xc/xc/viewOrderDetails?orderNumber={code}",
        "label": "Order",
        "priority": 2,
    },
    {
        "category": "Order",
        "name": "Best Buy Order",
        "icon": "/static/tracking/order.svg",
        "keywords": [
            re.compile(r"\b(bestbuy\.com)\b", re.IGNORECASE),
            re.compile(r"\b(best\s*buy)\s+(order|confirmation|purchase)\b", re.IGNORECASE),
        ],
        "regex": re.compile(r"\b(BBY\d{2}-\d{8,12})\b", re.IGNORECASE),
        "url": "https://www.bestbuy.com/profile/ss/orderlookup",
        "label": "Order",
        "priority": 3,
    },
    {
        "category": "Order",
        "name": "Walmart Order",
        "icon": "/static/tracking/order.svg",
        "keywords": [
            re.compile(r"\b(walmart\.com)\b", re.IGNORECASE),
            re.compile(r"\b(walmart)\s+(order|confirmation|purchase)\b", re.IGNORECASE),
        ],
        "regex": re.compile(r"\b(\d{13,16})\b"),
        "url": "https://www.walmart.com/orders",
        "label": "Order",
        "priority": 4,
    },
    {
        "category": "Order",
        "name": "Target Order",
        "icon": "/static/tracking/order.svg",
        "keywords": [
            re.compile(r"\b(target\.com)\b", re.IGNORECASE),
            re.compile(r"\b(target)\s+(order|confirmation|purchase)\b", re.IGNORECASE),
        ],
        "regex": re.compile(r"\b(\d{9,15})\b"),
        "url": "https://www.target.com/orders",
        "label": "Order",
        "priority": 5,
    },
]


# ═══════════════════════════════════════════════════════════════════════════
# Configuration & Custom Detector Compilation
# ═══════════════════════════════════════════════════════════════════════════

def _compile_custom_detectors(custom_defs):
    """
    Compile custom detector definitions from user settings into usable detector dicts.

    Each custom def is a dict with string regex patterns that need to be compiled.
    Returns a list of compiled detector dicts matching the built-in format.
    """
    compiled = []
    if not custom_defs:
        return compiled

    for cd in custom_defs:
        if not cd.get("enabled", True):
            continue
        try:
            compiled_regex = re.compile(cd["regex"])
            compiled_keywords = None
            if cd.get("keywords"):
                compiled_keywords = [re.compile(kw, re.IGNORECASE) for kw in cd["keywords"]]

            compiled.append({
                "category": cd.get("category", "Custom"),
                "name": cd["name"],
                "icon": cd.get("icon", "/static/tracking/order.svg"),
                "keywords": compiled_keywords,
                "regex": compiled_regex,
                "url": cd["url"],
                "label": cd.get("label", "View"),
                "priority": cd.get("priority", 50),
                "extract": None,
            })
        except (re.error, KeyError) as e:
            # Skip invalid custom detectors silently
            continue

    return compiled


def _load_smart_actions_config(settings):
    """
    Load the smart_actions_config from the settings dict.

    The settings dict may have smart_actions_config as:
      - A JSON string (from DB)
      - A dict (already parsed)
      - None (no config)

    Returns a parsed config dict with keys:
      disabled, disabledCategories, maxResults, customDetectors
    """
    raw = settings.get("smart_actions_config") if settings else None
    if not raw:
        return {
            "disabled": {},
            "disabledCategories": [],
            "maxResults": 3,
            "customDetectors": [],
        }

    if isinstance(raw, str):
        try:
            config = json.loads(raw)
        except (json.JSONDecodeError, TypeError):
            return {
                "disabled": {},
                "disabledCategories": [],
                "maxResults": 3,
                "customDetectors": [],
            }
    else:
        config = raw

    return {
        "disabled": config.get("disabled", {}),
        "disabledCategories": config.get("disabledCategories", []),
        "maxResults": config.get("maxResults", 3),
        "customDetectors": config.get("customDetectors", []),
    }


# ═══════════════════════════════════════════════════════════════════════════
# Detection Engine
# ═══════════════════════════════════════════════════════════════════════════

def detect_badges(chit, settings=None):
    """
    Detect all badge-worthy smart links in an email chit.

    Scans subject + body_text + from against all registered detectors.
    Respects user configuration (disabled detectors/categories, custom detectors).
    Returns deduplicated results — unique (provider_name, code) pairs.

    Args:
        chit: dict with email fields (email_subject, email_body_text, email_from, title)
        settings: dict with user settings (smart_actions_config field)

    Returns:
        list of dicts, each with:
            category, provider_name, code, url, icon, label
    """
    if not chit:
        return []

    # Load user config
    config = _load_smart_actions_config(settings)

    # Build the text to scan
    subject = chit.get("email_subject") or chit.get("title") or ""
    body_text = chit.get("email_body_text") or ""
    from_addr = chit.get("email_from") or ""

    text = subject + " " + body_text
    full_text = text + " " + from_addr

    if not full_text.strip():
        return []

    # Combine built-in and custom detectors
    custom_detectors = _compile_custom_detectors(config["customDetectors"])
    all_detectors = BUILT_IN_DETECTORS + custom_detectors

    # Sort detectors by category then priority
    sorted_detectors = sorted(
        all_detectors,
        key=lambda d: (d["category"], d.get("priority", 10))
    )

    results = []
    seen = set()  # (provider_name, code) deduplication

    disabled = config["disabled"]
    disabled_categories = config["disabledCategories"]

    for det in sorted_detectors:
        # Skip disabled categories
        if det["category"] in disabled_categories:
            continue

        # Skip individually disabled detectors
        if disabled.get(det["name"]):
            continue

        # Check keywords (if specified, at least one must match)
        if det["keywords"]:
            keyword_match = False
            for kw_pattern in det["keywords"]:
                if kw_pattern.search(full_text):
                    keyword_match = True
                    break
            if not keyword_match:
                continue

        # Try regex match against the text (not including from for regex)
        match = det["regex"].search(text)
        if not match:
            continue

        # Extract the code
        extract_fn = det.get("extract")
        if extract_fn:
            code = extract_fn(match)
        else:
            code = (match.group(1) if match.lastindex and match.lastindex >= 1 else match.group(0)).upper()

        # Deduplication: skip if we've already seen this (provider_name, code) pair
        dedup_key = (det["name"], code)
        if dedup_key in seen:
            continue
        seen.add(dedup_key)

        # Build URL
        url = det["url"].replace("{code}", _url_quote(code, safe=""))

        results.append({
            "category": det["category"],
            "provider_name": det["name"],
            "code": code,
            "url": url,
            "icon": det["icon"],
            "label": det["label"],
        })

    return results
