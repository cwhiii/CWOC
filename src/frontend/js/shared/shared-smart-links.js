/**
 * shared-smart-links.js — Generalized "smart link" detection for email chits.
 *
 * Scans email subject + body text for recognizable patterns (tracking numbers,
 * flight numbers, hotel confirmations, rental cars, events, etc.) and returns
 * actionable buttons the user can click to open the relevant external site.
 *
 * Architecture:
 *   - A registry of "detectors" — each defines keywords, regex patterns, and
 *     a URL template. Detectors are grouped by category.
 *   - `detectSmartLinks(chit)` runs all detectors against the chit text and
 *     returns an array of matches (not just the first one).
 *   - The email card renderer calls this and shows one or more action buttons.
 *
 * Depends on: nothing (standalone utility)
 * Loaded before: main-email.js, editor-email.js
 */

// ═══════════════════════════════════════════════════════════════════════════
// Smart Link Registry
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Each detector entry:
 *   category  — grouping label (Package, Flight, Hotel, Rental, Event, Restaurant)
 *   name      — display name (e.g. "UPS", "Marriott")
 *   icon      — path to SVG icon (relative to /static/tracking/)
 *   keywords  — array of regex patterns that must be present in text (OR logic)
 *               null means "always try the regex" (for format-unique patterns like 1Z...)
 *   regex     — regex to extract the actionable code/number. First capture group is used.
 *   url       — URL template. {code} is replaced with the matched value.
 *   label     — button label text (e.g. "Track", "Manage", "View")
 *   priority  — lower = checked first within category (default 10)
 */
var _smartLinkDetectors = [

    // ─── Package Tracking ────────────────────────────────────────────────────

    {
        category: 'Package',
        name: 'UPS',
        icon: '/static/tracking/ups.svg',
        keywords: null, // 1Z format is unique enough
        regex: /\b(1Z[0-9A-Z]{16})\b/i,
        url: 'https://www.ups.com/track?tracknum={code}',
        label: 'Track',
        priority: 1
    },
    {
        category: 'Package',
        name: 'FedEx',
        icon: '/static/tracking/fedex.svg',
        keywords: [/\b(fedex|fed\s*ex|federal\s*express)\b/i],
        regex: /\b(\d{12}|\d{15}|\d{20}|\d{22})\b/,
        url: 'https://www.fedex.com/fedextrack/?trknbr={code}',
        label: 'Track',
        priority: 2
    },
    {
        category: 'Package',
        name: 'USPS',
        icon: '/static/tracking/usps.svg',
        keywords: null, // format is distinctive
        regex: /\b(\d{20,22})\b/,
        url: 'https://tools.usps.com/go/TrackConfirmAction?tLabels={code}',
        label: 'Track',
        priority: 3
    },
    {
        category: 'Package',
        name: 'USPS Intl',
        icon: '/static/tracking/usps.svg',
        keywords: null,
        regex: /\b([A-Z]{2}\d{9}[A-Z]{2})\b/,
        url: 'https://tools.usps.com/go/TrackConfirmAction?tLabels={code}',
        label: 'Track',
        priority: 4
    },
    {
        category: 'Package',
        name: 'DHL',
        icon: '/static/tracking/dhl.svg',
        keywords: [/\b(dhl|deutsche\s*post)\b/i],
        regex: /\b(\d{10,11})\b/,
        url: 'https://www.dhl.com/us-en/home/tracking/tracking-parcel.html?submit=1&tracking-id={code}',
        label: 'Track',
        priority: 5
    },
    {
        category: 'Package',
        name: 'Amazon',
        icon: '/static/tracking/amazon.svg',
        keywords: [/\b(amazon|amzn)\b/i],
        regex: /\b(TBA\d{12,15})\b/i,
        url: 'https://www.amazon.com/gp/your-account/order-history?search={code}',
        label: 'Track',
        priority: 6
    },
    {
        category: 'Package',
        name: 'UniUni',
        icon: '/static/tracking/uniuni.svg',
        keywords: null,
        regex: /\b(UU[A-Z0-9]{8,18})\b/i,
        url: 'https://www.uniuni.com/en/tracking?tracking_id={code}',
        label: 'Track',
        priority: 7
    },
    {
        category: 'Package',
        name: 'OnTrac',
        icon: '/static/tracking/ontrac.svg',
        keywords: [/\b(ontrac|on\s*trac)\b/i],
        regex: /\b(C\d{14})\b/i,
        url: 'https://www.ontrac.com/tracking/?number={code}',
        label: 'Track',
        priority: 8
    },
    {
        category: 'Package',
        name: 'LaserShip',
        icon: '/static/tracking/lasership.svg',
        keywords: [/\b(lasership|laser\s*ship)\b/i],
        regex: /\b(L[A-Z]\d{8,14})\b/i,
        url: 'https://www.lasership.com/track/{code}',
        label: 'Track',
        priority: 9
    },

    // ─── Flights ─────────────────────────────────────────────────────────────

    {
        category: 'Flight',
        name: 'Flight',
        icon: '/static/tracking/flight.svg',
        keywords: [/\b(flight|depart|arriv|board|gate|terminal|itinerary|booking|airline|boarding\s*pass)\b/i],
        regex: /\b([A-Z]{2}|[A-Z]\d|\d[A-Z])\s?(\d{1,4})\b/,
        url: 'https://www.flightradar24.com/{code}',
        label: 'Flight',
        priority: 1,
        // Custom extractor: combines two capture groups
        _extract: function(match) { return (match[1] + match[2]).toUpperCase(); }
    },

    // ─── Hotels ──────────────────────────────────────────────────────────────

    {
        category: 'Hotel',
        name: 'Marriott',
        icon: '/static/tracking/hotel.svg',
        keywords: [/\b(marriott|bonvoy|sheraton|westin|w\s*hotel|courtyard|fairfield|springhill|residence\s*inn|towneplace|aloft|element|moxy|le\s*meridien|st\.?\s*regis|ritz.carlton)\b/i],
        regex: /\b(\d{8,9})\b/,
        url: 'https://www.marriott.com/reservation/lookUpConfirmation.mi',
        label: 'Manage',
        priority: 1
    },
    {
        category: 'Hotel',
        name: 'Hilton',
        icon: '/static/tracking/hotel.svg',
        keywords: [/\b(hilton|hampton\s*inn|doubletree|embassy\s*suites|homewood\s*suites|home2|waldorf|conrad|canopy|curio|tapestry|tempo|motto|lxr)\b/i],
        regex: /\b(\d{8,10})\b/,
        url: 'https://www.hilton.com/en/book/reservation/find/',
        label: 'Manage',
        priority: 2
    },
    {
        category: 'Hotel',
        name: 'IHG',
        icon: '/static/tracking/hotel.svg',
        keywords: [/\b(ihg|holiday\s*inn|crowne\s*plaza|intercontinental|indigo|candlewood|staybridge|even\s*hotel|avid\s*hotel|atwell|vignette|kimpton)\b/i],
        regex: /\b(\d{8,11})\b/,
        url: 'https://www.ihg.com/hotels/us/en/find-hotels/hotel/rooms',
        label: 'Manage',
        priority: 3
    },
    {
        category: 'Hotel',
        name: 'Hyatt',
        icon: '/static/tracking/hotel.svg',
        keywords: [/\b(hyatt|park\s*hyatt|grand\s*hyatt|andaz|thompson|alila|caption|hyatt\s*place|hyatt\s*house)\b/i],
        regex: /\b([A-Z0-9]{6,12})\b/,
        url: 'https://www.hyatt.com/en-US/member/my-trips',
        label: 'Manage',
        priority: 4
    },
    {
        category: 'Hotel',
        name: 'Airbnb',
        icon: '/static/tracking/airbnb.svg',
        keywords: [/\b(airbnb)\b/i],
        regex: /\b(HM[A-Z0-9]{6,12}|[A-Z0-9]{10,12})\b/,
        url: 'https://www.airbnb.com/trips/v1',
        label: 'View',
        priority: 5
    },
    {
        category: 'Hotel',
        name: 'Booking.com',
        icon: '/static/tracking/hotel.svg',
        keywords: [/\b(booking\.com)\b/i],
        regex: /\b(\d{7,12})\b/,
        url: 'https://secure.booking.com/myreservations.html',
        label: 'Manage',
        priority: 6
    },
    {
        category: 'Hotel',
        name: 'VRBO',
        icon: '/static/tracking/hotel.svg',
        keywords: [/\b(vrbo|homeaway)\b/i],
        regex: /\b(HA-[A-Z0-9]{6,10}|[A-Z0-9]{8,12})\b/,
        url: 'https://www.vrbo.com/trips',
        label: 'View',
        priority: 7
    },

    // ─── Rental Cars ─────────────────────────────────────────────────────────

    {
        category: 'Rental',
        name: 'Enterprise',
        icon: '/static/tracking/rental.svg',
        keywords: [/\b(enterprise|national\s*car|alamo)\b/i],
        regex: /\b([A-Z0-9]{7,12})\b/,
        url: 'https://www.enterprise.com/en/reserve/view-modify-cancel.html',
        label: 'Manage',
        priority: 1
    },
    {
        category: 'Rental',
        name: 'Hertz',
        icon: '/static/tracking/rental.svg',
        keywords: [/\b(hertz|dollar\s*car|thrifty)\b/i],
        regex: /\b([A-Z]\d{8,10})\b/,
        url: 'https://www.hertz.com/rentacar/receipts/request-receipts.do',
        label: 'Manage',
        priority: 2
    },
    {
        category: 'Rental',
        name: 'Avis/Budget',
        icon: '/static/tracking/rental.svg',
        keywords: [/\b(avis|budget\s*car|budget\s*rent)\b/i],
        regex: /\b([A-Z0-9]{8,12})\b/,
        url: 'https://www.avis.com/en/reservation/view-modify-cancel',
        label: 'Manage',
        priority: 3
    },
    {
        category: 'Rental',
        name: 'Turo',
        icon: '/static/tracking/rental.svg',
        keywords: [/\b(turo)\b/i],
        regex: /\b([A-Z0-9]{6,12})\b/,
        url: 'https://turo.com/trips',
        label: 'View',
        priority: 4
    },

    // ─── Events & Tickets ────────────────────────────────────────────────────

    {
        category: 'Event',
        name: 'Ticketmaster',
        icon: '/static/tracking/event.svg',
        keywords: [/\b(ticketmaster|livenation|live\s*nation)\b/i],
        regex: /\b(\d{2}-\d{5}-\d{7}|\d{13,16})\b/,
        url: 'https://www.ticketmaster.com/member/orders',
        label: 'Tickets',
        priority: 1
    },
    {
        category: 'Event',
        name: 'Eventbrite',
        icon: '/static/tracking/event.svg',
        keywords: [/\b(eventbrite)\b/i],
        regex: /\b(\d{10,12})\b/,
        url: 'https://www.eventbrite.com/mytickets/',
        label: 'Tickets',
        priority: 2
    },
    {
        category: 'Event',
        name: 'AXS',
        icon: '/static/tracking/event.svg',
        keywords: [/\b(axs\.com|axs\s*tickets)\b/i],
        regex: /\b([A-Z0-9]{8,14})\b/,
        url: 'https://www.axs.com/orders',
        label: 'Tickets',
        priority: 3
    },
    {
        category: 'Event',
        name: 'StubHub',
        icon: '/static/tracking/event.svg',
        keywords: [/\b(stubhub)\b/i],
        regex: /\b(\d{8,12})\b/,
        url: 'https://www.stubhub.com/my/orders',
        label: 'Tickets',
        priority: 4
    },
    {
        category: 'Event',
        name: 'SeatGeek',
        icon: '/static/tracking/event.svg',
        keywords: [/\b(seatgeek)\b/i],
        regex: /\b([A-Z0-9]{6,12})\b/,
        url: 'https://seatgeek.com/orders',
        label: 'Tickets',
        priority: 5
    },

    // ─── Restaurants ─────────────────────────────────────────────────────────

    {
        category: 'Restaurant',
        name: 'OpenTable',
        icon: '/static/tracking/restaurant.svg',
        keywords: [/\b(opentable)\b/i],
        regex: /\b([A-Z0-9]{8,14})\b/,
        url: 'https://www.opentable.com/my/reservations',
        label: 'View',
        priority: 1
    },
    {
        category: 'Restaurant',
        name: 'Resy',
        icon: '/static/tracking/restaurant.svg',
        keywords: [/\b(resy)\b/i],
        regex: /\b([A-Z0-9]{6,12})\b/,
        url: 'https://resy.com/account/reservations',
        label: 'View',
        priority: 2
    },

    // ─── Rideshare & Transit ─────────────────────────────────────────────────

    {
        category: 'Transit',
        name: 'Uber',
        icon: '/static/tracking/transit.svg',
        keywords: [/\b(uber)\b/i, /\b(trip\s*receipt|ride\s*receipt)\b/i],
        regex: /\b([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})\b/i,
        url: 'https://riders.uber.com/trips',
        label: 'View',
        priority: 1
    },
    {
        category: 'Transit',
        name: 'Lyft',
        icon: '/static/tracking/transit.svg',
        keywords: [/\b(lyft)\b/i],
        regex: /\b([A-Z0-9]{8,14})\b/,
        url: 'https://www.lyft.com/ride-history',
        label: 'View',
        priority: 2
    }
];

// ═══════════════════════════════════════════════════════════════════════════
// Detection Engine
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Detect all smart links in an email chit.
 * Scans title + email_subject + email_body_text against all registered detectors.
 *
 * @param {Object} chit - The email chit object
 * @param {Object} [options] - Options
 * @param {number} [options.maxResults=3] - Maximum number of results to return
 * @returns {Array} Array of { category, name, code, url, icon, label } objects
 */
function detectSmartLinks(chit, options) {
    var opts = options || {};
    var maxResults = opts.maxResults || 3;

    var text = (chit.title || '') + ' ' + (chit.email_subject || '') + ' ' + (chit.email_body_text || '');
    if (!text.trim()) return [];

    // Also check sender domain for keyword-based detectors
    var senderText = (chit.email_from || '');
    var fullText = text + ' ' + senderText;

    var results = [];
    var usedCategories = {}; // Only one result per category to avoid clutter

    // Sort detectors by priority within category
    var sorted = _smartLinkDetectors.slice().sort(function(a, b) {
        if (a.category !== b.category) return a.category.localeCompare(b.category);
        return (a.priority || 10) - (b.priority || 10);
    });

    for (var i = 0; i < sorted.length; i++) {
        if (results.length >= maxResults) break;
        var det = sorted[i];

        // Skip if we already have a result for this category
        if (usedCategories[det.category]) continue;

        // Check keywords (if specified, at least one must match)
        if (det.keywords) {
            var keywordMatch = false;
            for (var k = 0; k < det.keywords.length; k++) {
                if (det.keywords[k].test(fullText)) {
                    keywordMatch = true;
                    break;
                }
            }
            if (!keywordMatch) continue;
        }

        // Try regex match
        var match = text.match(det.regex);
        if (!match) continue;

        // Extract the code
        var code;
        if (det._extract) {
            code = det._extract(match);
        } else {
            code = (match[1] || match[0]).toUpperCase();
        }

        // Build URL
        var url = det.url.replace('{code}', encodeURIComponent(code));

        results.push({
            category: det.category,
            name: det.name,
            code: code,
            url: url,
            icon: det.icon,
            label: det.label
        });

        usedCategories[det.category] = true;
    }

    return results;
}

/**
 * Legacy compatibility wrapper — returns the first match in the old format.
 * Used by existing code that expects { carrier, number, url, logo }.
 *
 * @param {Object} chit - The email chit object
 * @returns {Object|null} { carrier, number, url, logo } or null
 */
function detectSmartLinkFirst(chit) {
    var links = detectSmartLinks(chit, { maxResults: 1 });
    if (links.length === 0) return null;
    var link = links[0];
    return {
        carrier: link.name,
        number: link.code,
        url: link.url,
        logo: link.icon
    };
}
