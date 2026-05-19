package com.cwoc.app.domain.email

/**
 * A detected smart link from an email body — represents an actionable badge
 * (tracking number, flight, hotel confirmation, etc.) that the user can tap
 * to open the relevant external service.
 *
 * @param category Grouping label: Package, Flight, Hotel, Rental, Event, Restaurant, Transit, Order
 * @param label Button text shown on the badge (e.g., "Track", "Manage", "View", "Tickets", "Order", "Flight")
 * @param url The fully-formed URL to open when the badge is tapped
 * @param logoRes Optional drawable resource ID for the carrier/service logo (null = use category default)
 */
data class SmartLink(
    val category: String,
    val label: String,
    val url: String,
    val logoRes: Int? = null
)

/**
 * Detects actionable smart links in email body text by scanning for recognized
 * patterns: package tracking numbers, flight numbers, hotel confirmations,
 * rental car reservations, event tickets, restaurant reservations, rideshare
 * receipts, and order confirmations.
 *
 * Mirrors the web implementation in shared-smart-links.js. Each detector has:
 * - A category (only one result per category is returned)
 * - Optional keywords that must be present for the regex to fire
 * - A regex to extract the actionable code/number
 * - A URL template where {code} is replaced with the matched value
 *
 * The function enforces:
 * - At most [maxBadges] total results (default 3)
 * - At most 1 result per category
 */
object SmartLinkDetector {

    /**
     * Internal detector definition.
     */
    private data class Detector(
        val category: String,
        val name: String,
        val keywords: List<Regex>?,  // null = always try regex; non-null = at least one must match
        val regex: Regex,
        val url: String,             // URL template with {code} placeholder
        val label: String,
        val priority: Int = 10,
        val extractGroups: Boolean = false  // true for flight: combine group 1+2
    )

    /**
     * All built-in detectors, ordered by priority within each category.
     * Mirrors the web's _smartLinkDetectors array.
     */
    private val detectors: List<Detector> = listOf(
        // ─── Package Tracking ────────────────────────────────────────────────

        Detector(
            category = "Package",
            name = "UPS",
            keywords = null,  // 1Z format is unique enough
            regex = Regex("\\b(1Z[0-9A-Z]{16})\\b", RegexOption.IGNORE_CASE),
            url = "https://www.ups.com/track?tracknum={code}",
            label = "Track",
            priority = 1
        ),
        Detector(
            category = "Package",
            name = "FedEx",
            keywords = listOf(Regex("\\b(fedex|fed\\s*ex|federal\\s*express)\\b", RegexOption.IGNORE_CASE)),
            regex = Regex("\\b(\\d{12}|\\d{15}|\\d{20}|\\d{22})\\b"),
            url = "https://www.fedex.com/fedextrack/?trknbr={code}",
            label = "Track",
            priority = 2
        ),
        Detector(
            category = "Package",
            name = "USPS",
            keywords = listOf(
                Regex("\\b(usps|postal\\s*service|united\\s*states\\s*postal)\\b", RegexOption.IGNORE_CASE),
                Regex("\\b(tracking|shipment|delivered|delivery|package)\\b", RegexOption.IGNORE_CASE)
            ),
            regex = Regex("\\b(\\d{20,22})\\b"),
            url = "https://tools.usps.com/go/TrackConfirmAction?tLabels={code}",
            label = "Track",
            priority = 3
        ),
        Detector(
            category = "Package",
            name = "USPS Intl",
            keywords = null,
            regex = Regex("\\b([A-Z]{2}\\d{9}[A-Z]{2})\\b"),
            url = "https://tools.usps.com/go/TrackConfirmAction?tLabels={code}",
            label = "Track",
            priority = 4
        ),
        Detector(
            category = "Package",
            name = "DHL",
            keywords = listOf(Regex("\\b(dhl|deutsche\\s*post)\\b", RegexOption.IGNORE_CASE)),
            regex = Regex("\\b(\\d{10,11})\\b"),
            url = "https://www.dhl.com/us-en/home/tracking/tracking-parcel.html?submit=1&tracking-id={code}",
            label = "Track",
            priority = 5
        ),
        Detector(
            category = "Package",
            name = "Amazon",
            keywords = listOf(Regex("\\b(amazon|amzn)\\b", RegexOption.IGNORE_CASE)),
            regex = Regex("\\b(TBA\\d{12,15})\\b", RegexOption.IGNORE_CASE),
            url = "https://www.amazon.com/gp/your-account/order-history?search={code}",
            label = "Track",
            priority = 6
        ),
        Detector(
            category = "Package",
            name = "UniUni",
            keywords = null,
            regex = Regex("\\b(UU[A-Z0-9]{8,18})\\b", RegexOption.IGNORE_CASE),
            url = "https://www.uniuni.com/en/tracking?tracking_id={code}",
            label = "Track",
            priority = 7
        ),
        Detector(
            category = "Package",
            name = "OnTrac",
            keywords = listOf(Regex("\\b(ontrac|on\\s*trac)\\b", RegexOption.IGNORE_CASE)),
            regex = Regex("\\b(C\\d{14})\\b", RegexOption.IGNORE_CASE),
            url = "https://www.ontrac.com/tracking/?number={code}",
            label = "Track",
            priority = 8
        ),
        Detector(
            category = "Package",
            name = "LaserShip",
            keywords = listOf(Regex("\\b(lasership|laser\\s*ship)\\b", RegexOption.IGNORE_CASE)),
            regex = Regex("\\b(L[A-Z]\\d{8,14})\\b", RegexOption.IGNORE_CASE),
            url = "https://www.lasership.com/track/{code}",
            label = "Track",
            priority = 9
        ),

        // ─── Flights ─────────────────────────────────────────────────────────

        Detector(
            category = "Flight",
            name = "Flight",
            keywords = listOf(Regex("\\b(flight|depart|arriv|board|gate|terminal|itinerary|booking|airline|boarding\\s*pass)\\b", RegexOption.IGNORE_CASE)),
            regex = Regex("\\b([A-Z]{2}|[A-Z]\\d|\\d[A-Z])\\s?(\\d{1,4})\\b"),
            url = "https://www.flightradar24.com/{code}",
            label = "Flight",
            priority = 1,
            extractGroups = true  // Combine group 1 + group 2
        ),

        // ─── Hotels ──────────────────────────────────────────────────────────

        Detector(
            category = "Hotel",
            name = "Marriott",
            keywords = listOf(Regex("\\b(marriott|bonvoy|sheraton|westin|w\\s*hotel|courtyard|fairfield|springhill|residence\\s*inn|towneplace|aloft|element|moxy|le\\s*meridien|st\\.?\\s*regis|ritz.carlton)\\b", RegexOption.IGNORE_CASE)),
            regex = Regex("\\b(\\d{8,9})\\b"),
            url = "https://www.marriott.com/reservation/lookUpConfirmation.mi",
            label = "Manage",
            priority = 1
        ),
        Detector(
            category = "Hotel",
            name = "Hilton",
            keywords = listOf(Regex("\\b(hilton|hampton\\s*inn|doubletree|embassy\\s*suites|homewood\\s*suites|home2|waldorf|conrad|canopy|curio|tapestry|tempo|motto|lxr)\\b", RegexOption.IGNORE_CASE)),
            regex = Regex("\\b(\\d{8,10})\\b"),
            url = "https://www.hilton.com/en/book/reservation/find/",
            label = "Manage",
            priority = 2
        ),
        Detector(
            category = "Hotel",
            name = "IHG",
            keywords = listOf(Regex("\\b(ihg|holiday\\s*inn|crowne\\s*plaza|intercontinental|indigo|candlewood|staybridge|even\\s*hotel|avid\\s*hotel|atwell|vignette|kimpton)\\b", RegexOption.IGNORE_CASE)),
            regex = Regex("\\b(\\d{8,11})\\b"),
            url = "https://www.ihg.com/hotels/us/en/find-hotels/hotel/rooms",
            label = "Manage",
            priority = 3
        ),
        Detector(
            category = "Hotel",
            name = "Hyatt",
            keywords = listOf(Regex("\\b(hyatt|park\\s*hyatt|grand\\s*hyatt|andaz|thompson|alila|caption|hyatt\\s*place|hyatt\\s*house)\\b", RegexOption.IGNORE_CASE)),
            regex = Regex("\\b([A-Z0-9]{6,12})\\b"),
            url = "https://www.hyatt.com/en-US/member/my-trips",
            label = "Manage",
            priority = 4
        ),
        Detector(
            category = "Hotel",
            name = "Airbnb",
            keywords = listOf(Regex("\\b(airbnb)\\b", RegexOption.IGNORE_CASE)),
            regex = Regex("\\b(HM[A-Z0-9]{6,12}|[A-Z0-9]{10,12})\\b"),
            url = "https://www.airbnb.com/trips/v1",
            label = "View",
            priority = 5
        ),
        Detector(
            category = "Hotel",
            name = "Booking.com",
            keywords = listOf(Regex("\\b(booking\\.com)\\b", RegexOption.IGNORE_CASE)),
            regex = Regex("\\b(\\d{7,12})\\b"),
            url = "https://secure.booking.com/myreservations.html",
            label = "Manage",
            priority = 6
        ),
        Detector(
            category = "Hotel",
            name = "VRBO",
            keywords = listOf(Regex("\\b(vrbo|homeaway)\\b", RegexOption.IGNORE_CASE)),
            regex = Regex("\\b(HA-[A-Z0-9]{6,10}|[A-Z0-9]{8,12})\\b"),
            url = "https://www.vrbo.com/trips",
            label = "View",
            priority = 7
        ),
        Detector(
            category = "Hotel",
            name = "Wyndham",
            keywords = listOf(Regex("\\b(wyndham|days\\s*inn|super\\s*8|ramada|la\\s*quinta|wingate|baymont|microtel|hawthorn|trademark|tryp|dolce)\\b", RegexOption.IGNORE_CASE)),
            regex = Regex("\\b(\\d{8,12})\\b"),
            url = "https://www.wyndhamhotels.com/wyndham-rewards/member/reservations",
            label = "Manage",
            priority = 8
        ),

        // ─── Rental Cars ─────────────────────────────────────────────────────

        Detector(
            category = "Rental",
            name = "Enterprise",
            keywords = listOf(Regex("\\b(enterprise|national\\s*car|alamo)\\b", RegexOption.IGNORE_CASE)),
            regex = Regex("\\b([A-Z0-9]{7,12})\\b"),
            url = "https://www.enterprise.com/en/reserve/view-modify-cancel.html",
            label = "Manage",
            priority = 1
        ),
        Detector(
            category = "Rental",
            name = "Hertz",
            keywords = listOf(Regex("\\b(hertz|dollar\\s*car|thrifty)\\b", RegexOption.IGNORE_CASE)),
            regex = Regex("\\b([A-Z]\\d{8,10})\\b"),
            url = "https://www.hertz.com/rentacar/receipts/request-receipts.do",
            label = "Manage",
            priority = 2
        ),
        Detector(
            category = "Rental",
            name = "Avis/Budget",
            keywords = listOf(Regex("\\b(avis|budget\\s*car|budget\\s*rent)\\b", RegexOption.IGNORE_CASE)),
            regex = Regex("\\b([A-Z0-9]{8,12})\\b"),
            url = "https://www.avis.com/en/reservation/view-modify-cancel",
            label = "Manage",
            priority = 3
        ),
        Detector(
            category = "Rental",
            name = "Turo",
            keywords = listOf(Regex("\\b(turo)\\b", RegexOption.IGNORE_CASE)),
            regex = Regex("\\b([A-Z0-9]{6,12})\\b"),
            url = "https://turo.com/trips",
            label = "View",
            priority = 4
        ),

        // ─── Events & Tickets ────────────────────────────────────────────────

        Detector(
            category = "Event",
            name = "Ticketmaster",
            keywords = listOf(Regex("\\b(ticketmaster|livenation|live\\s*nation)\\b", RegexOption.IGNORE_CASE)),
            regex = Regex("\\b(\\d{2}-\\d{5}-\\d{7}|\\d{13,16})\\b"),
            url = "https://www.ticketmaster.com/member/orders",
            label = "Tickets",
            priority = 1
        ),
        Detector(
            category = "Event",
            name = "Eventbrite",
            keywords = listOf(Regex("\\b(eventbrite)\\b", RegexOption.IGNORE_CASE)),
            regex = Regex("\\b(\\d{10,12})\\b"),
            url = "https://www.eventbrite.com/mytickets/",
            label = "Tickets",
            priority = 2
        ),
        Detector(
            category = "Event",
            name = "AXS",
            keywords = listOf(Regex("\\b(axs\\.com|axs\\s*tickets)\\b", RegexOption.IGNORE_CASE)),
            regex = Regex("\\b([A-Z0-9]{8,14})\\b"),
            url = "https://www.axs.com/orders",
            label = "Tickets",
            priority = 3
        ),
        Detector(
            category = "Event",
            name = "StubHub",
            keywords = listOf(Regex("\\b(stubhub)\\b", RegexOption.IGNORE_CASE)),
            regex = Regex("\\b(\\d{8,12})\\b"),
            url = "https://www.stubhub.com/my/orders",
            label = "Tickets",
            priority = 4
        ),
        Detector(
            category = "Event",
            name = "SeatGeek",
            keywords = listOf(Regex("\\b(seatgeek)\\b", RegexOption.IGNORE_CASE)),
            regex = Regex("\\b([A-Z0-9]{6,12})\\b"),
            url = "https://seatgeek.com/orders",
            label = "Tickets",
            priority = 5
        ),

        // ─── Restaurants ─────────────────────────────────────────────────────

        Detector(
            category = "Restaurant",
            name = "OpenTable",
            keywords = listOf(Regex("\\b(opentable)\\b", RegexOption.IGNORE_CASE)),
            regex = Regex("\\b([A-Z0-9]{8,14})\\b"),
            url = "https://www.opentable.com/my/reservations",
            label = "View",
            priority = 1
        ),
        Detector(
            category = "Restaurant",
            name = "Resy",
            keywords = listOf(Regex("\\b(resy)\\b", RegexOption.IGNORE_CASE)),
            regex = Regex("\\b([A-Z0-9]{6,12})\\b"),
            url = "https://resy.com/account/reservations",
            label = "View",
            priority = 2
        ),

        // ─── Rideshare & Transit ─────────────────────────────────────────────

        Detector(
            category = "Transit",
            name = "Uber",
            keywords = listOf(
                Regex("\\b(uber)\\b", RegexOption.IGNORE_CASE),
                Regex("\\b(trip\\s*receipt|ride\\s*receipt)\\b", RegexOption.IGNORE_CASE)
            ),
            regex = Regex("\\b([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})\\b", RegexOption.IGNORE_CASE),
            url = "https://riders.uber.com/trips",
            label = "View",
            priority = 1
        ),
        Detector(
            category = "Transit",
            name = "Lyft",
            keywords = listOf(Regex("\\b(lyft)\\b", RegexOption.IGNORE_CASE)),
            regex = Regex("\\b([A-Z0-9]{8,14})\\b"),
            url = "https://www.lyft.com/ride-history",
            label = "View",
            priority = 2
        ),

        // ─── Orders & Confirmations ──────────────────────────────────────────

        Detector(
            category = "Order",
            name = "Amazon Order",
            keywords = listOf(
                Regex("\\b(amazon\\.com|amzn\\.com)\\b", RegexOption.IGNORE_CASE),
                Regex("\\b(amazon|amzn)\\s+(order|shipment|delivery)\\b", RegexOption.IGNORE_CASE)
            ),
            regex = Regex("\\b(\\d{3}-\\d{7}-\\d{7})\\b"),
            url = "https://www.amazon.com/gp/your-account/order-history?search={code}",
            label = "Order",
            priority = 1
        ),
        Detector(
            category = "Order",
            name = "Apple Order",
            keywords = listOf(
                Regex("\\b(apple\\.com)\\b", RegexOption.IGNORE_CASE),
                Regex("\\b(apple\\s+store|apple\\s+order|apple\\s+receipt)\\b", RegexOption.IGNORE_CASE)
            ),
            regex = Regex("\\b(W\\d{9,12})\\b", RegexOption.IGNORE_CASE),
            url = "https://store.apple.com/xc/xc/viewOrderDetails?orderNumber={code}",
            label = "Order",
            priority = 2
        ),
        Detector(
            category = "Order",
            name = "Best Buy Order",
            keywords = listOf(
                Regex("\\b(bestbuy\\.com)\\b", RegexOption.IGNORE_CASE),
                Regex("\\b(best\\s*buy)\\s+(order|confirmation|purchase)\\b", RegexOption.IGNORE_CASE)
            ),
            regex = Regex("\\b(BBY\\d{2}-\\d{8,12})\\b", RegexOption.IGNORE_CASE),
            url = "https://www.bestbuy.com/profile/ss/orderlookup",
            label = "Order",
            priority = 3
        ),
        Detector(
            category = "Order",
            name = "Walmart Order",
            keywords = listOf(
                Regex("\\b(walmart\\.com)\\b", RegexOption.IGNORE_CASE),
                Regex("\\b(walmart)\\s+(order|confirmation|purchase)\\b", RegexOption.IGNORE_CASE)
            ),
            regex = Regex("\\b(\\d{13,16})\\b"),
            url = "https://www.walmart.com/orders",
            label = "Order",
            priority = 4
        ),
        Detector(
            category = "Order",
            name = "Target Order",
            keywords = listOf(
                Regex("\\b(target\\.com)\\b", RegexOption.IGNORE_CASE),
                Regex("\\b(target)\\s+(order|confirmation|purchase)\\b", RegexOption.IGNORE_CASE)
            ),
            regex = Regex("\\b(\\d{9,15})\\b"),
            url = "https://www.target.com/orders",
            label = "Order",
            priority = 5
        )
    )

    /**
     * Detect smart links in email body text.
     *
     * Scans the provided text against all registered detectors, respecting
     * the max badges constraint and the one-per-category rule.
     *
     * @param bodyText The email body text (plain text, may include subject/sender context)
     * @param maxBadges Maximum number of badges to return (default 3)
     * @return List of detected SmartLink objects, at most [maxBadges] items with at most 1 per category
     */
    fun detect(bodyText: String, maxBadges: Int = 3): List<SmartLink> {
        if (bodyText.isBlank()) return emptyList()

        val results = mutableListOf<SmartLink>()
        val usedCategories = mutableSetOf<String>()

        // Sort detectors by category then priority (lower priority = checked first)
        val sorted = detectors.sortedWith(compareBy({ it.category }, { it.priority }))

        for (det in sorted) {
            if (results.size >= maxBadges) break

            // Skip if we already have a result for this category
            if (det.category in usedCategories) continue

            // Check keywords — if specified, at least one must match
            if (det.keywords != null) {
                val keywordMatch = det.keywords.any { it.containsMatchIn(bodyText) }
                if (!keywordMatch) continue
            }

            // Try regex match
            val match = det.regex.find(bodyText) ?: continue

            // Extract the code
            val code = if (det.extractGroups && match.groupValues.size >= 3) {
                // Flight: combine group 1 + group 2
                (match.groupValues[1] + match.groupValues[2]).uppercase()
            } else {
                (match.groupValues.getOrNull(1) ?: match.value).uppercase()
            }

            // Build URL
            val url = det.url.replace("{code}", java.net.URLEncoder.encode(code, "UTF-8"))

            results.add(
                SmartLink(
                    category = det.category,
                    label = det.label,
                    url = url,
                    logoRes = null  // Logo resources assigned at UI layer based on category/name
                )
            )

            usedCategories.add(det.category)
        }

        return results
    }
}
