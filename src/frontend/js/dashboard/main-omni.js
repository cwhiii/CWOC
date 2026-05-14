/**
 * main-omni.js — Omni View rendering, HST bar, section orchestration, email pagination, filter lock.
 *
 * Contains:
 *   - displayOmniView(filteredChits) — main entry point, builds two-column layout
 *   - _renderOmniHST(chronoItems, weatherHourly) — Horizontal Strip Timeline bar
 *   - _renderOmniWeather(contentEl) — weather bar section
 *   - _renderOmniEmail() — email section with pagination
 *   - _lockOmniFilters() — save current filters as Omni defaults
 *
 * Depends on globals from main.js: chits, currentTab, _cwocSettings
 * Depends on main-calendar.js: _buildItineraryEvent, _buildItineraryHabitCard
 * Depends on main-email-bundles.js: _buildEmailCard
 * Depends on shared.js: showQuickEditModal, _openWeatherModal, _getWeatherIcon
 */

/* ── Omni View state ─────────────────────────────────────────────────────── */

var _omniEmailPage = 0;            // Email pagination offset
var _omniLockedFilters = null;     // Persisted filter defaults
var _omniHSTInterval = null;       // HST bar update interval
var _omniTimeUntilInterval = null; // Time-until badge update interval
var _omniFiltersApplied = false;   // Prevents re-applying filters on every render cycle
var _omniHSTMode = 'both';        // HST bar icon mode: 'chits', 'both', 'weather', 'none'

/* ── Default layout config ───────────────────────────────────────────────── */

var _omniDefaultLayout = [
    { id: "hst", width: "full", visible: true, position: 0, hideWhenEmpty: true },
    { id: "weather", width: "full", visible: true, position: 1, hideWhenEmpty: true },
    { id: "hst_weather", width: "full", visible: false, position: 2, hideWhenEmpty: true },
    { id: "hst_temp_strip", width: "full", visible: false, position: 3, hideWhenEmpty: true },
    { id: "chrono", width: "half", visible: true, position: 4, column: "left", hideWhenEmpty: true },
    { id: "reminders", width: "half", visible: true, position: 5, column: "left", hideWhenEmpty: true },
    { id: "ondeck", width: "half", visible: true, position: 6, column: "left", hideWhenEmpty: true },
    { id: "soon", width: "half", visible: true, position: 7, column: "left", hideWhenEmpty: true },
    { id: "email", width: "half", visible: true, position: 8, column: "left", hideWhenEmpty: true },
    { id: "pinned_notes", width: "half", visible: true, position: 9, column: "right", hideWhenEmpty: true },
    { id: "pinned_checklists", width: "half", visible: true, position: 10, column: "right", hideWhenEmpty: true },
    { id: "pinned_all", width: "half", visible: false, position: 11, column: "right", hideWhenEmpty: true }
];

/* ── Section display names and icons ─────────────────────────────────────── */

var _omniSectionMeta = {
    hst: { label: "HST Bar", icon: "" },
    weather: { label: "Weather", icon: "" },
    hst_weather: { label: "HST + Weather", icon: "📊🌤️" },
    hst_temp_strip: { label: "HST Weather Strip", icon: "" },
    chrono: { label: "Chrono Anchored", icon: "⏰" },
    reminders: { label: "Reminders", icon: "📢" },
    ondeck: { label: "On Deck", icon: "🔜" },
    soon: { label: "Soon", icon: "🗓️" },
    email: { label: "Email", icon: "📧" },
    pinned_notes: { label: "Pinned Notes", icon: "📝" },
    pinned_checklists: { label: "Pinned Checklists", icon: "☑️" },
    pinned_all: { label: "Pinned", icon: "📌" }
};

/* ── Omni View entry point ───────────────────────────────────────────────── */

function displayOmniView(filteredChits) {
    // 1. Clear any existing Omni intervals
    if (_omniHSTInterval) { clearInterval(_omniHSTInterval); _omniHSTInterval = null; }
    if (_omniTimeUntilInterval) { clearInterval(_omniTimeUntilInterval); _omniTimeUntilInterval = null; }

    // 2. Reset email pagination on entry
    _omniEmailPage = 0;

    // 2.5. Reset sidebar filters or apply locked defaults on Omni View entry
    //      Uses _omniFiltersApplied flag to prevent infinite loop:
    //      (filter change → displayChits → displayOmniView → filter change → ...)
    if (!_omniFiltersApplied) {
        _omniFiltersApplied = true;
        _applyOmniEntryFilters();
    }

    // 2.7. Show the 🔒 Lock Filters button in the sidebar
    _showOmniLockBtn();

    // 3. Get the content container (same pattern as displayItineraryView)
    var chitList = document.getElementById("chit-list");
    if (!chitList) { console.error('[Omni] chit-list container not found'); return; }
    chitList.innerHTML = "";

    // 4. Load layout config from settings (or use defaults)
    var layout = _omniDefaultLayout;
    var settings = window._cwocSettings || {};
    if (settings.omni_layout) {
        try {
            var parsed = (typeof settings.omni_layout === 'string')
                ? JSON.parse(settings.omni_layout)
                : settings.omni_layout;
            if (Array.isArray(parsed) && parsed.length > 0) {
                layout = parsed;
                // Merge in any new default blocks not present in saved layout
                var savedIds = new Set(layout.map(function(s) { return s.id; }));
                _omniDefaultLayout.forEach(function(def) {
                    if (!savedIds.has(def.id)) {
                        layout.push(Object.assign({}, def));
                    }
                });
                // Ensure hideWhenEmpty is set on all items (backfill for older saved layouts)
                layout.forEach(function(item) {
                    if (item.hideWhenEmpty === undefined) {
                        var def = _omniDefaultLayout.find(function(d) { return d.id === item.id; });
                        item.hideWhenEmpty = def ? def.hideWhenEmpty : true;
                    }
                });
            }
        } catch (e) {
            console.error('[Omni] Failed to parse omni_layout, using defaults:', e);
        }
    }

    // 5. Sort layout by position and filter to visible sections only
    var visibleSections = layout
        .filter(function(s) { return s.visible !== false; })
        .sort(function(a, b) { return (a.position || 0) - (b.position || 0); });

    console.log('[OmniLayout] layout source:', settings.omni_layout ? 'saved' : 'defaults');
    console.log('[OmniLayout] all layout items:', JSON.stringify(layout.map(function(s) { return { id: s.id, visible: s.visible, width: s.width, column: s.column }; })));
    console.log('[OmniLayout] visibleSections:', visibleSections.map(function(s) { return s.id; }));
    console.log('[OmniLayout] is "email" in visible?', visibleSections.some(function(s) { return s.id === 'email'; }));

    // 6. Build the Omni View container
    var omniContainer = document.createElement("div");
    omniContainer.className = "omni-view";

    // 7. Render sections in position order, interleaving full-width and half-width.
    //    Consecutive half-width sections are grouped into a two-column grid.
    //    Full-width sections break the grid and render standalone.
    var leftSections = [];
    var rightSections = [];

    function _flushColumns() {
        if (leftSections.length === 0 && rightSections.length === 0) return;
        var gridContainer = document.createElement("div");
        gridContainer.className = "omni-grid";

        var leftCol = document.createElement("div");
        leftCol.className = "omni-col omni-col-left";
        leftSections.forEach(function(sectionConfig) {
            var sectionEl = _buildOmniSection(sectionConfig, "omni-section-half");
            if (sectionEl) leftCol.appendChild(sectionEl);
        });

        var rightCol = document.createElement("div");
        rightCol.className = "omni-col omni-col-right";
        rightSections.forEach(function(sectionConfig) {
            var sectionEl = _buildOmniSection(sectionConfig, "omni-section-half");
            if (sectionEl) rightCol.appendChild(sectionEl);
        });

        gridContainer.appendChild(leftCol);
        gridContainer.appendChild(rightCol);
        omniContainer.appendChild(gridContainer);
        leftSections = [];
        rightSections = [];
    }

    visibleSections.forEach(function(s) {
        if (s.width === "full") {
            // Flush any pending half-width columns before this full-width section
            _flushColumns();
            var sectionEl = _buildOmniSection(s, "omni-section-full");
            if (sectionEl) omniContainer.appendChild(sectionEl);
        } else {
            // Half-width: accumulate into left/right columns
            if (s.column === "right") {
                rightSections.push(s);
            } else if (s.column === "left") {
                leftSections.push(s);
            } else {
                var def = _omniDefaultLayout.find(function(d) { return d.id === s.id; });
                if (def && def.column === "right") {
                    rightSections.push(s);
                } else {
                    leftSections.push(s);
                }
            }
        }
    });

    // Flush any remaining half-width columns
    _flushColumns();

    chitList.appendChild(omniContainer);

    // 10. Route to section renderers
    _populateOmniSections(filteredChits, visibleSections);
}

/* ── Build a section wrapper element ─────────────────────────────────────── */

function _buildOmniSection(sectionConfig, widthClass) {
    var meta = _omniSectionMeta[sectionConfig.id] || { label: sectionConfig.id, icon: "" };

    var section = document.createElement("div");
    section.className = "omni-section " + widthClass;
    section.dataset.omniSection = sectionConfig.id;

    // HST and Weather bars don't get a visible header (they are self-contained)
    if (sectionConfig.id !== "hst" && sectionConfig.id !== "weather" && sectionConfig.id !== "hst_weather" && sectionConfig.id !== "hst_temp_strip") {
        var header = document.createElement("div");
        header.className = "omni-section-header";
        header.innerHTML = (meta.icon ? '<span class="omni-section-icon">' + meta.icon + '</span> ' : '') + meta.label;
        section.appendChild(header);
    }

    // Content container for the section renderer to populate
    var content = document.createElement("div");
    content.className = "omni-section-content";
    content.id = "omni-content-" + sectionConfig.id;
    section.appendChild(content);

    return section;
}

/* ── Deduplication Algorithm ──────────────────────────────────────────────── */

/**
 * Categorizes chits into Omni View sections with strict deduplication.
 * Each chit appears in exactly one section.
 *
 * Algorithm:
 *   1. Separate email chits → email section only
 *   2. Categorize remaining into itinerary buckets (same logic as displayItineraryView):
 *      - Has time today → Chrono Anchored
 *      - All-day today / untimed due today / habit due today → On Deck
 *      - Due this week (not today) → Soon
 *   3. Track all chit IDs placed in steps 1-2
 *   4. For pinned chits NOT already placed:
 *      - Has checklist items → Pinned Checklists
 *      - Otherwise → Pinned Notes
 *   5. Each chit appears in exactly one section
 *
 * @param {Array} filteredChits - The filtered chits array
 * @returns {Object} { email: [], chrono: [], ondeck: [], soon: [], pinned_notes: [], pinned_checklists: [] }
 */
function _omniDeduplicateChits(filteredChits) {
    var result = {
        email: [],
        reminders: [],
        chrono: [],
        ondeck: [],
        soon: [],
        pinned_notes: [],
        pinned_checklists: []
    };

    var placedIds = new Set();

    var now = new Date();
    var today = new Date(now);
    today.setHours(0, 0, 0, 0);
    var todayEnd = new Date(today);
    todayEnd.setHours(23, 59, 59, 999);

    // End of week (7 days from today start)
    var weekEnd = new Date(today);
    weekEnd.setDate(weekEnd.getDate() + 7);

    // ── Step 0: Separate reminder chits (today, not complete) ────────────────
    filteredChits.forEach(function(chit) {
        if (chit.notification && chit.point_in_time && chit.status !== 'Complete' && !chit.archived) {
            var pitDate = new Date(chit.point_in_time);
            if (pitDate >= today && pitDate <= todayEnd) {
                result.reminders.push(chit);
                placedIds.add(chit.id);
            }
        }
    });

    // ── Step 1: Separate email chits ────────────────────────────────────────
    // Use the GLOBAL chits array for emails — sidebar filters should not exclude emails
    // from the Omni View email section (they have their own bundle-based filtering)
    var _allChits = (typeof chits !== 'undefined' && Array.isArray(chits)) ? chits : filteredChits;
    _allChits.forEach(function(chit) {
        if (chit.email_message_id) {
            result.email.push(chit);
            placedIds.add(chit.id);
        }
    });
    console.log('[OmniDedup] Step 1: email chits separated:', result.email.length, 'from global chits:', _allChits.length, '(filteredChits was:', filteredChits.length, ')');

    // ── Step 2: Categorize remaining into itinerary buckets ─────────────────
    // Process habits first (same logic as displayItineraryView)
    var _originalChits = (typeof chits !== 'undefined') ? chits : filteredChits;
    var settings = window._cwocSettings || {};
    var habitChits = _originalChits.filter(function(c) {
        return c.habit === true && c.status !== 'Complete' && c.status !== 'Rejected';
    });

    habitChits.forEach(function(chit) {
        if (placedIds.has(chit.id)) return;

        // Evaluate rollover
        if (typeof _evaluateHabitRollover === 'function') {
            var rolledOver = _evaluateHabitRollover(chit);
            if (rolledOver && typeof _persistHabitRollover === 'function') {
                _persistHabitRollover(chit);
            }
        }

        var goal = chit.habit_goal || 1;
        var success = chit.habit_success || 0;
        // Skip completed habits
        if (success >= goal) return;

        // Calculate days left in cycle
        var rule = chit.recurrence_rule;
        var freq = (rule && rule.freq) ? rule.freq : 'DAILY';
        var interval = (rule && rule.interval) ? rule.interval : 1;
        var daysInCycle = 1;
        if (freq === 'DAILY') daysInCycle = 1 * interval;
        else if (freq === 'WEEKLY') daysInCycle = 7 * interval;
        else if (freq === 'MONTHLY') daysInCycle = 30 * interval;
        else if (freq === 'YEARLY') daysInCycle = 365 * interval;

        var currentPeriod = (typeof getCurrentPeriodDate === 'function') ? getCurrentPeriodDate(chit) : null;
        var daysLeft = daysInCycle;
        if (currentPeriod) {
            var periodStart = new Date(currentPeriod + 'T00:00:00');
            var elapsed = Math.floor((today - periodStart) / 86400000);
            if (elapsed < 0) return; // Period hasn't started yet
            daysLeft = Math.max(0, daysInCycle - elapsed);
        }

        if (daysLeft <= 1) {
            // Due today — On Deck
            result.ondeck.push({ type: 'habit', chit: chit, goal: goal, success: success, daysLeft: daysLeft });
            placedIds.add(chit.id);
        } else {
            // Active but not due today — Soon
            var dueDate = new Date(today);
            dueDate.setDate(dueDate.getDate() + daysLeft);
            result.soon.push({ type: 'habit', chit: chit, goal: goal, success: success, daysLeft: daysLeft, dueDate: dueDate });
            placedIds.add(chit.id);
        }
    });

    // Process non-habit chits (same logic as displayItineraryView)
    var _seenChitIds = new Set(placedIds);
    // Pre-seed with habit IDs so they don't get double-processed
    habitChits.forEach(function(c) { _seenChitIds.add(c.id); });

    filteredChits.forEach(function(chit) {
        if (placedIds.has(chit.id)) return;
        if (chit.habit) return;
        if (chit.status === 'Complete') return;
        if (chit.point_in_time && !chit.start_datetime && !chit.due_datetime) return;
        if (chit.email_message_id || chit.email_status) return;

        // Skip virtual recurrence instances not matching today
        if (chit._isVirtual) {
            var vDate = chit._virtualDate;
            var todayStr = today.toISOString().slice(0, 10);
            if (vDate !== todayStr) return;
        }

        // Skip non-recurring chits whose dates are entirely outside today/this week
        if (!chit._isVirtual && !chit.recurrence_rule) {
            var hasStart = !!chit.start_datetime;
            var hasDue = !!chit.due_datetime;
            if (hasStart && !hasDue) {
                var sd = chit.start_datetime_obj || new Date(chit.start_datetime);
                var ed = chit.end_datetime_obj || (chit.end_datetime ? new Date(chit.end_datetime) : new Date(sd.getTime() + 3600000));
                if (ed < today) return;
            }
            if (hasDue && !hasStart) {
                var dd = new Date(chit.due_datetime);
                if (dd < today) return;
            }
            if (hasStart && hasDue) {
                var sd2 = chit.start_datetime_obj || new Date(chit.start_datetime);
                var dd2 = new Date(chit.due_datetime);
                if (sd2 < today && dd2 < today) return;
            }
        }

        // Deduplicate by chit ID (or parent ID for virtuals)
        var dedupId = chit._isVirtual ? (chit._parentId + '_' + chit._virtualDate) : chit.id;
        if (_seenChitIds.has(dedupId)) return;
        _seenChitIds.add(dedupId);

        var isAllDay = !!(chit.all_day || chit.allDay);
        var hasStart = !!chit.start_datetime;
        var hasDue = !!chit.due_datetime;
        var isTask = !!(chit.status && chit.status !== '');

        // All-day events today → On Deck
        if (isAllDay && hasStart) {
            var startDate = chit.start_datetime_obj || new Date(chit.start_datetime);
            var endDate = chit.end_datetime_obj || (chit.end_datetime ? new Date(chit.end_datetime) : startDate);
            if (startDate <= todayEnd && endDate >= today) {
                result.ondeck.push({ type: 'event', chit: chit });
                placedIds.add(chit.id);
                return;
            }
        }

        // Timed events today → Chrono Anchored
        if (hasStart && !isAllDay) {
            var startDate = chit.start_datetime_obj || new Date(chit.start_datetime);
            var endDate = chit.end_datetime_obj || (chit.end_datetime ? new Date(chit.end_datetime) : new Date(startDate.getTime() + 3600000));
            if (startDate <= todayEnd && endDate >= today) {
                var eventIsPast = endDate <= now;
                if (eventIsPast && !isTask) return; // Past non-task events hidden
                result.chrono.push({ type: 'event', chit: chit, start: startDate, end: endDate, isPast: eventIsPast });
                placedIds.add(chit.id);
                return;
            }
        }

        // Due today with a specific time → Chrono Anchored
        if (hasDue) {
            var dueDate = new Date(chit.due_datetime);
            var dueHour = dueDate.getHours();
            var dueMin = dueDate.getMinutes();
            if ((dueHour > 0 || dueMin > 0) && dueDate >= today && dueDate <= todayEnd) {
                var dueIsPast = dueDate <= now;
                if (dueIsPast && !isTask) return;
                result.chrono.push({ type: 'event', chit: chit, start: dueDate, end: new Date(dueDate.getTime() + 1800000), isPast: dueIsPast });
                placedIds.add(chit.id);
                return;
            }
        }

        // Due today (no specific time) → On Deck
        if (hasDue) {
            var dueDate = new Date(chit.due_datetime);
            if (dueDate >= today && dueDate <= todayEnd) {
                result.ondeck.push({ type: 'task', chit: chit });
                placedIds.add(chit.id);
                return;
            }
            // Due this week (not today) → Soon
            if (dueDate > todayEnd && dueDate <= weekEnd) {
                result.soon.push({ type: 'task', chit: chit, dueDate: dueDate });
                placedIds.add(chit.id);
                return;
            }
        }
    });

    // ── Step 3: Sort chrono and soon ────────────────────────────────────────
    result.chrono.sort(function(a, b) { return a.start - b.start; });
    result.soon.sort(function(a, b) {
        var aDate = a.dueDate || new Date(9999, 0);
        var bDate = b.dueDate || new Date(9999, 0);
        return aDate - bDate;
    });

    // ── Step 4: Pinned chits NOT already placed ─────────────────────────────
    filteredChits.forEach(function(chit) {
        if (placedIds.has(chit.id)) return;
        if (!chit.pinned) return;
        if (chit.archived) return;

        // Has checklist items → Pinned Checklists
        var checklist = chit.checklist;
        if (typeof checklist === 'string') {
            try { checklist = JSON.parse(checklist); } catch (e) { checklist = null; }
        }
        var hasChecklist = Array.isArray(checklist) && checklist.length > 0;

        if (hasChecklist) {
            result.pinned_checklists.push(chit);
        } else {
            result.pinned_notes.push(chit);
        }
        placedIds.add(chit.id);
    });

    return result;
}

/* ── Route to section renderers ──────────────────────────────────────────── */

function _populateOmniSections(filteredChits, visibleSections) {
    var _viSettings = (window._cwocSettings || {}).visual_indicators || {};

    // Run deduplication to get categorized data
    var categorized = _omniDeduplicateChits(filteredChits);
    console.log('[OmniSections] _populateOmniSections: visibleSections=', visibleSections.map(function(s) { return s.id; }));
    console.log('[OmniSections] categorized.email length:', categorized.email ? categorized.email.length : 'undefined');

    visibleSections.forEach(function(sectionConfig) {
        var contentEl = document.getElementById("omni-content-" + sectionConfig.id);
        if (!contentEl) return;

        switch (sectionConfig.id) {
            case "hst":
                // HST Bar — implemented in task 7.1
                if (typeof _renderOmniHST === 'function') {
                    _renderOmniHST(contentEl, categorized.chrono);
                }
                break;
            case "weather":
                // Weather Bar — implemented in task 8.1
                if (typeof _renderOmniWeather === 'function') {
                    _renderOmniWeather(contentEl);
                }
                break;
            case "hst_weather":
                // Combined HST + Weather side by side
                _renderOmniHSTWeatherCombo(contentEl, categorized.chrono);
                break;
            case "hst_temp_strip":
                // HST bar with temperature color strip underneath
                _renderOmniHSTTempStrip(contentEl, categorized.chrono);
                break;
            case "chrono":
                // Chrono Anchored — implemented in task 6.1
                if (typeof _renderOmniChrono === 'function') {
                    _renderOmniChrono(contentEl, categorized.chrono, _viSettings);
                }
                break;
            case "reminders":
                _renderOmniReminders(contentEl, categorized.reminders, _viSettings);
                break;
            case "ondeck":
                // On Deck — implemented in task 6.2
                if (typeof _renderOmniOnDeck === 'function') {
                    _renderOmniOnDeck(contentEl, categorized.ondeck, _viSettings);
                }
                break;
            case "soon":
                // Soon — implemented in task 6.3
                if (typeof _renderOmniSoon === 'function') {
                    _renderOmniSoon(contentEl, categorized.soon, _viSettings);
                }
                break;
            case "email":
                // Email — implemented in task 10.1
                console.log('[OmniEmail] CASE "email" reached, categorized.email length:', categorized.email ? categorized.email.length : 'undefined');
                if (typeof _renderOmniEmail === 'function') {
                    _renderOmniEmail(contentEl, categorized.email);
                } else {
                    console.log('[OmniEmail] _renderOmniEmail function NOT FOUND');
                }
                break;
            case "pinned_notes":
                // Pinned Notes — implemented in task 9.1
                if (typeof _renderOmniPinnedNotes === 'function') {
                    _renderOmniPinnedNotes(contentEl, categorized.pinned_notes, _viSettings);
                }
                break;
            case "pinned_checklists":
                // Pinned Checklists — implemented in task 9.2
                if (typeof _renderOmniPinnedChecklists === 'function') {
                    _renderOmniPinnedChecklists(contentEl, categorized.pinned_checklists, _viSettings);
                }
                break;
            case "pinned_all":
                // Combined Pinned Notes + Checklists in one section
                var allPinned = (categorized.pinned_notes || []).concat(categorized.pinned_checklists || []);
                if (allPinned.length > 0) {
                    // Render checklists first, then notes
                    var pinnedChecklists = categorized.pinned_checklists || [];
                    var pinnedNotes = categorized.pinned_notes || [];
                    if (pinnedChecklists.length > 0 && typeof _renderOmniPinnedChecklists === 'function') {
                        _renderOmniPinnedChecklists(contentEl, pinnedChecklists, _viSettings);
                    }
                    if (pinnedNotes.length > 0 && typeof _renderOmniPinnedNotes === 'function') {
                        // Create a sub-container so notes append after checklists
                        var notesContainer = document.createElement('div');
                        notesContainer.className = 'omni-pinned-all-notes';
                        _renderOmniPinnedNotes(notesContainer, pinnedNotes, _viSettings);
                        contentEl.appendChild(notesContainer);
                    }
                }
                break;
        }

        // Hide empty sections based on per-section hideWhenEmpty setting
        if (sectionConfig.id !== "hst" && sectionConfig.id !== "weather" && sectionConfig.id !== "hst_weather" && sectionConfig.id !== "hst_temp_strip") {
            var sectionEl = contentEl.parentElement;
            var items;
            if (sectionConfig.id === "pinned_all") {
                items = (categorized.pinned_notes || []).concat(categorized.pinned_checklists || []);
            } else {
                var dataKey = sectionConfig.id === "pinned_notes" ? "pinned_notes" :
                              sectionConfig.id === "pinned_checklists" ? "pinned_checklists" :
                              sectionConfig.id;
                items = categorized[dataKey] || [];
            }
            if (items.length === 0 && sectionEl) {
                // Check hideWhenEmpty setting (default true for backward compat)
                var shouldHide = sectionConfig.hideWhenEmpty !== false;
                if (shouldHide) {
                    sectionEl.style.display = "none";
                } else {
                    // Show empty state message
                    var meta = _omniSectionMeta[sectionConfig.id] || { label: sectionConfig.id };
                    if (!contentEl.innerHTML.trim()) {
                        contentEl.innerHTML = '<div class="omni-empty">No ' + meta.label.toLowerCase() + ' right now.</div>';
                    }
                }
            }
        }
    });

    // ── Normalize colors if enabled ─────────────────────────────────────────
    var settings = window._cwocSettings || {};
    if (settings.omni_normalize_colors === '1') {
        _applyOmniNormalizedColors();
    }
}

/* ── Omni Normalized Colors ────────────────────────────────────────────────── */

/** Fixed earthy tones for each chit type when normalize is enabled */
var _omniNormalizedColorMap = {
    event:     '#7ab87a',  // medium green (calendar events)
    task:      '#c4a0d4',  // soft purple (tasks with status)
    note:      '#d4956b',  // terracotta (notes)
    checklist: '#9cc4d8',  // medium sky blue (has checklist items)
    birthday:  '#d8a8d8',  // medium orchid (contact birthdays)
    email:     '#a89070',  // dark mocha (email chits)
    habit:     '#f0e87a',  // light yellow (habits)
};

/**
 * Walk all .chit-card elements in the Omni View and override their background
 * color based on chit type.
 */
function _applyOmniNormalizedColors() {
    var omniView = document.querySelector('.omni-view');
    if (!omniView) return;

    var allChits = (typeof chits !== 'undefined' && Array.isArray(chits)) ? chits : [];

    // Walk each section and apply colors based on SECTION type, not chit properties
    var sections = omniView.querySelectorAll('.omni-section');
    sections.forEach(function(section) {
        var sectionId = section.dataset.omniSection;
        var cards = section.querySelectorAll('[data-chit-id]');

        cards.forEach(function(card) {
            var chitId = card.dataset.chitId;
            var chit = allChits.find(function(c) { return c.id === chitId; });
            var color;

            // Sections that always use a fixed color
            if (sectionId === 'chrono' || sectionId === 'ondeck' || sectionId === 'soon') {
                // Birthdays and habits get their own color
                if (chit && chit._isBirthday) {
                    color = _omniNormalizedColorMap.birthday;
                } else if (chit && chit.habit) {
                    color = _omniNormalizedColorMap.habit;
                } else if (chit && chit.status && chit.status !== '') {
                    color = _omniNormalizedColorMap.task;
                } else {
                    color = _omniNormalizedColorMap.event;
                }
            } else if (sectionId === 'pinned_notes' || (sectionId === 'pinned_all' && card.closest('.omni-pinned-all-notes'))) {
                color = _omniNormalizedColorMap.note;
            } else if (sectionId === 'pinned_checklists' || (sectionId === 'pinned_all' && !card.closest('.omni-pinned-all-notes'))) {
                color = _omniNormalizedColorMap.checklist;
            } else if (sectionId === 'email') {
                color = _omniNormalizedColorMap.email;
            } else if (chit) {
                color = _omniGetNormalizedColor(chit);
            } else {
                return;
            }

            card.style.backgroundColor = color;
            card.style.color = (typeof contrastColorForBg === 'function') ? contrastColorForBg(color) : '#1a1208';
        });
    });
}

/**
 * Determine the normalized color for a chit based on its type.
 */
function _omniGetNormalizedColor(chit) {
    // Email
    if (chit.email_message_id || chit.email_status) return _omniNormalizedColorMap.email;
    // Birthday (contact-generated birthday/anniversary chits)
    if (chit._isBirthday) return _omniNormalizedColorMap.birthday;
    // Habit
    if (chit.habit) return _omniNormalizedColorMap.habit;
    // Checklist
    var cl = chit.checklist;
    if (typeof cl === 'string') { try { cl = JSON.parse(cl); } catch(e) { cl = null; } }
    if (Array.isArray(cl) && cl.length > 0) return _omniNormalizedColorMap.checklist;
    // Task (has status)
    if (chit.status && chit.status !== '') return _omniNormalizedColorMap.task;
    // Event (has dates)
    if (chit.start_datetime || chit.due_datetime) return _omniNormalizedColorMap.event;
    // Note (everything else)
    return _omniNormalizedColorMap.note;
}

/* ── Chrono Anchored Section ──────────────────────────────────────────────── */

/**
 * Renders the Chrono Anchored section: timed events happening today.
 * Reuses _buildItineraryEvent() for card rendering and adds time-until badges.
 *
 * @param {HTMLElement} contentEl - The section content container
 * @param {Array} chronoItems - Array of { type: 'event', chit, start, end, isPast }
 * @param {Object} viSettings - Visual indicator settings
 */
function _renderOmniChrono(contentEl, chronoItems, viSettings) {
    if (!chronoItems || chronoItems.length === 0) return;

    var now = new Date();

    // Filter out events that have fully ended (end time < now)
    var activeItems = chronoItems.filter(function(item) {
        if (!item.start) return false;
        // Use end time if available, otherwise start + 1 hour
        var endTime = item.end || new Date(item.start.getTime() + 3600000);
        return endTime > now;
    });

    if (activeItems.length === 0) return;

    activeItems.forEach(function(item) {
        var cardEl = _buildItineraryEvent(item.chit, viSettings, { isPast: item.isPast });

        // Add time-until badge
        var badge = _buildTimeUntilBadge(item.start, now);
        if (badge) {
            cardEl.appendChild(badge);
        }

        contentEl.appendChild(cardEl);
    });

    // Set up periodic update for time-until badges (every 60 seconds)
    if (_omniTimeUntilInterval) { clearInterval(_omniTimeUntilInterval); }
    _omniTimeUntilInterval = setInterval(function() {
        _updateOmniTimeUntilBadges(contentEl);
    }, 60000);
}

/**
 * Builds a time-until badge element for a given start time.
 * Format: "now" (within 5 min), "in Xm" (under 60 min), "in Xh Ym" (over 60 min)
 *
 * @param {Date} startTime - The event start time
 * @param {Date} now - Current time
 * @returns {HTMLElement|null} The badge span element, or null if past
 */
function _buildTimeUntilBadge(startTime, now) {
    var diffMs = startTime - now;
    if (diffMs < 0) return null;

    var diffMin = Math.round(diffMs / 60000);
    var text = _formatTimeUntil(diffMin);

    var badge = document.createElement("span");
    badge.className = "omni-time-badge";
    badge.dataset.startTime = startTime.toISOString();
    badge.textContent = text;
    return badge;
}

/**
 * Formats minutes-until into a readable badge string.
 * @param {number} minutes - Minutes until event
 * @returns {string} Formatted string
 */
function _formatTimeUntil(minutes) {
    if (minutes <= 5) return "now";
    if (minutes < 60) return "in " + minutes + "m";
    var hours = Math.floor(minutes / 60);
    var mins = minutes % 60;
    if (mins === 0) return "in " + hours + "h";
    return "in " + hours + "h " + mins + "m";
}

/**
 * Updates all time-until badges in the Chrono section.
 * Called every 60 seconds by the interval.
 *
 * @param {HTMLElement} contentEl - The chrono section content container
 */
function _updateOmniTimeUntilBadges(contentEl) {
    var badges = contentEl.querySelectorAll('.omni-time-badge');
    var now = new Date();

    badges.forEach(function(badge) {
        var startTime = new Date(badge.dataset.startTime);
        var diffMs = startTime - now;

        if (diffMs < 0) {
            // Event has passed — remove the card
            var card = badge.closest('.itinerary-event');
            if (card) card.remove();
            return;
        }

        var diffMin = Math.round(diffMs / 60000);
        badge.textContent = _formatTimeUntil(diffMin);
    });
}

/* ── On Deck Section ──────────────────────────────────────────────────────── */

/**
 * Renders the On Deck section: all-day events today, untimed tasks due today,
 * and habits due today. Reuses _buildItineraryEvent() for events/tasks and
 * _buildItineraryHabitCard() for habits, adding streak counter badges.
 *
 * @param {HTMLElement} contentEl - The section content container
 * @param {Array} ondeckItems - Array of deduplication results:
/* ── Reminders section renderer ───────────────────────────────────────────── */

function _renderOmniReminders(contentEl, reminderChits, viSettings) {
    if (!reminderChits || reminderChits.length === 0) {
        contentEl.innerHTML = '<div class="omni-empty">No reminders for today.</div>';
        return;
    }

    // Sort by point_in_time ascending
    reminderChits.sort(function(a, b) {
        return (a.point_in_time || '').localeCompare(b.point_in_time || '');
    });

    reminderChits.forEach(function(chit) {
        var card = document.createElement('div');
        card.className = 'chit-card reminder-card';
        card.style.cssText = 'margin-bottom:4px;padding:8px 12px;cursor:pointer;position:relative;display:flex;align-items:center;gap:8px;';
        card.dataset.chitId = chit.id;
        if (typeof applyChitColors === 'function') applyChitColors(card, typeof chitColor === 'function' ? chitColor(chit) : '#fdf6e3');

        // Complete button (check circle)
        var completeBtn = document.createElement('button');
        completeBtn.className = 'email-hover-btn';
        completeBtn.title = 'Mark Complete';
        completeBtn.innerHTML = '<i class="fas fa-check-circle"></i>';
        completeBtn.style.cssText = 'opacity:0.5;flex-shrink:0;';
        completeBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            card.style.transition = 'opacity 0.3s, transform 0.3s';
            card.style.opacity = '0.3';
            card.style.transform = 'translateX(20px)';
            _emailUndoToast(
                '✓ ' + (chit.title || 'Reminder'),
                function() {
                    fetch('/api/chits/' + encodeURIComponent(chit.id), {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ status: 'Complete', archived: true })
                    }).then(function(r) { if (r.ok) { card.remove(); if (typeof displayChits === 'function') displayChits(); } });
                },
                function() { card.style.opacity = ''; card.style.transform = ''; }
            );
        });
        card.appendChild(completeBtn);

        // Title
        var titleEl = document.createElement('a');
        titleEl.href = '/editor?id=' + chit.id;
        titleEl.textContent = chit.title || '(Untitled)';
        titleEl.style.cssText = 'flex:1;color:#4a2c2a;text-decoration:none;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
        titleEl.addEventListener('click', function(e) { e.preventDefault(); if (typeof storePreviousState === 'function') storePreviousState(); window.location.href = this.href; });
        card.appendChild(titleEl);

        // Time
        var pitDate = new Date(chit.point_in_time);
        var timeStr = String(pitDate.getHours()).padStart(2, '0') + ':' + String(pitDate.getMinutes()).padStart(2, '0');
        var timeEl = document.createElement('span');
        timeEl.style.cssText = 'font-size:0.85em;color:#6b4e31;white-space:nowrap;';
        timeEl.textContent = timeStr;
        card.appendChild(timeEl);

        card.addEventListener('dblclick', function() {
            if (typeof storePreviousState === 'function') storePreviousState();
            window.location.href = '/editor?id=' + chit.id;
        });

        contentEl.appendChild(card);
    });
}

/**
 *   { type: 'event'|'task', chit: {...} } — all-day events or untimed tasks
 *   { type: 'habit', chit: {...}, goal: N, success: N, daysLeft: N } — habits due today
 * @param {Object} viSettings - Visual indicator settings
 */
function _renderOmniOnDeck(contentEl, ondeckItems, viSettings) {
    if (!ondeckItems || ondeckItems.length === 0) return;

    var settings = window._cwocSettings || {};
    var windowDays = settings.habits_success_window || '30';

    ondeckItems.forEach(function(item) {
        if (item.type === 'habit') {
            // Render habit card using existing builder
            var hCard = _buildItineraryHabitCard(item, viSettings, windowDays);
            if (hCard) {
                // Calculate streak for the badge
                var streak = _calculateHabitStreak(item.chit);
                if (streak > 0) {
                    var streakBadge = document.createElement("span");
                    streakBadge.className = "omni-streak-badge";
                    streakBadge.textContent = "🔥 " + streak;
                    hCard.appendChild(streakBadge);
                }
                hCard.style.margin = "4px 0";
                contentEl.appendChild(hCard);
            }
        } else {
            // Events and tasks — reuse _buildItineraryEvent
            var el = _buildItineraryEvent(item.chit, viSettings);
            if (el) contentEl.appendChild(el);
        }
    });
}

/**
 * Calculates the consecutive successful periods (streak) for a habit chit.
 * Counts backwards from the most recent period entry — each period where
 * habit_success >= habit_goal increments the streak. Stops at the first miss.
 *
 * @param {Object} chit - The habit chit object
 * @returns {number} The current streak count
 */
function _calculateHabitStreak(chit) {
    var exceptions = chit.recurrence_exceptions || [];
    if (typeof exceptions === 'string') {
        try { exceptions = JSON.parse(exceptions); } catch (e) { return 0; }
    }

    // Build period entries (same logic as _buildItineraryHabitCard)
    var periodEntries = [];
    for (var i = 0; i < exceptions.length; i++) {
        var ex = exceptions[i];
        if (!ex.date || ex.broken_off) continue;
        if (ex.habit_success !== undefined && ex.habit_goal !== undefined) {
            periodEntries.push(ex);
        }
    }

    // Count consecutive successes from the end
    var streak = 0;
    for (var si = periodEntries.length - 1; si >= 0; si--) {
        if (periodEntries[si].habit_success >= periodEntries[si].habit_goal) {
            streak++;
        } else {
            break;
        }
    }

    return streak;
}

/* ── Soon Section ─────────────────────────────────────────────────────────── */

/**
 * Renders the Soon section: items due this week but not today.
 * Reuses _buildItineraryEvent() for events/tasks and _buildItineraryHabitCard()
 * for habits. Adds due-date badges showing when the item is due.
 *
 * @param {HTMLElement} contentEl - The section content container
 * @param {Array} soonItems - Array of deduplication results:
 *   { type: 'event'|'task', chit: {...}, dueDate: Date } — events/tasks due this week
 *   { type: 'habit', chit: {...}, goal: N, success: N, daysLeft: N, dueDate: Date } — habits due later this week
 * @param {Object} viSettings - Visual indicator settings
 */
function _renderOmniSoon(contentEl, soonItems, viSettings) {
    if (!soonItems || soonItems.length === 0) return;

    var settings = window._cwocSettings || {};
    var windowDays = settings.habits_success_window || '30';
    var now = new Date();

    soonItems.forEach(function(item) {
        if (item.type === 'habit') {
            // Render habit card using existing builder
            var hCard = _buildItineraryHabitCard(item, viSettings, windowDays);
            if (hCard) {
                // Calculate streak for the badge
                var streak = _calculateHabitStreak(item.chit);
                if (streak > 0) {
                    var streakBadge = document.createElement("span");
                    streakBadge.className = "omni-streak-badge";
                    streakBadge.textContent = "🔥 " + streak;
                    hCard.appendChild(streakBadge);
                }
                // Add due-date badge
                var dueBadge = _buildDueDateBadge(item.dueDate, now);
                if (dueBadge) hCard.appendChild(dueBadge);

                hCard.style.margin = "4px 0";
                contentEl.appendChild(hCard);
            }
        } else {
            // Events and tasks — reuse _buildItineraryEvent
            var el = _buildItineraryEvent(item.chit, viSettings);
            if (el) {
                // Add due-date badge
                var dueBadge = _buildDueDateBadge(item.dueDate, now);
                if (dueBadge) el.appendChild(dueBadge);
                contentEl.appendChild(el);
            }
        }
    });
}

/**
 * Builds a due-date badge element showing when an item is due.
 * Shows "Tomorrow" if due tomorrow, otherwise the short day name (e.g., "Tue", "Wed").
 *
 * @param {Date} dueDate - The date the item is due
 * @param {Date} now - Current time
 * @returns {HTMLElement|null} The badge span element, or null if no valid date
 */
function _buildDueDateBadge(dueDate, now) {
    if (!dueDate) return null;

    var due = (dueDate instanceof Date) ? dueDate : new Date(dueDate);
    if (isNaN(due.getTime())) return null;

    // Calculate days difference
    var today = new Date(now);
    today.setHours(0, 0, 0, 0);
    var dueDay = new Date(due);
    dueDay.setHours(0, 0, 0, 0);
    var diffDays = Math.round((dueDay - today) / 86400000);

    var text;
    if (diffDays <= 0) text = "today";
    else if (diffDays === 1) text = "1 day";
    else text = diffDays + " days";

    var badge = document.createElement("span");
    badge.className = "omni-due-badge";
    badge.textContent = text;
    return badge;
}

/* ── HST Bar ─────────────────────────────────────────────────────────────── */

/**
 * Renders the Omni HST (Horizontal Strip Timeline) bar.
 * Shows a full-width bar with gradient fill up to the current time,
 * chit type icons at their scheduled time positions, and weather icons
 * at their hour positions.
 *
 * @param {HTMLElement} contentEl - The section content container
 * @param {Array} chronoItems - Array of { type: 'event', chit, start, end, isPast }
 */
function _renderOmniHST(contentEl, chronoItems) {
    if (!contentEl) return;
    contentEl.innerHTML = "";

    // ── Build bar container ─────────────────────────────────────────────────
    var bar = document.createElement("div");
    bar.className = "omni-hst-bar";

    // ── Fill element (gradient up to current time) ──────────────────────────
    var fill = document.createElement("div");
    fill.className = "omni-hst-fill";
    bar.appendChild(fill);

    // ── Icons layer (positioned above fill) ─────────────────────────────────
    var iconsLayer = document.createElement("div");
    iconsLayer.className = "omni-hst-icons";
    bar.appendChild(iconsLayer);

    // ── Time display overlay ────────────────────────────────────────────────
    var timeOverlay = document.createElement("div");
    timeOverlay.className = "omni-hst-time-overlay";
    
    function _updateHSTTime() {
        // Use the SAME calculation as _renderClocks in main-modals.js
        var now = new Date();
        var h24 = now.getHours();
        var min = now.getMinutes();
        var sec = now.getSeconds();
        var dayFraction = (h24 * 3600 + min * 60 + sec) / 86400;
        var hstVal = (dayFraction * 100).toFixed(3);
        
        var settings = window._cwocSettings || {};
        var clockMode = settings.omni_hst_clock_mode || 'both';
        
        if (clockMode === 'hst') {
            timeOverlay.textContent = hstVal + ' sd';
        } else if (clockMode === 'system') {
            // Use _globalFmtTime if available (same as clock modal uses)
            var timeStr = String(h24).padStart(2, '0') + ':' + String(min).padStart(2, '0');
            if (typeof _globalFmtTime === 'function') {
                timeStr = _globalFmtTime(timeStr);
            } else if (typeof _sharedFmtTime === 'function') {
                timeStr = _sharedFmtTime(timeStr);
            }
            timeOverlay.textContent = timeStr;
        } else {
            // Both: show HST value centered (same display as clock modal HST bar)
            timeOverlay.textContent = hstVal + ' sd';
        }
    }
    _updateHSTTime();
    bar.appendChild(timeOverlay);

    contentEl.appendChild(bar);

    // ── Calculate current time percentage and update fill ────────────────────
    function _updateHSTFill() {
        var now = new Date();
        var h = now.getHours(), m = now.getMinutes(), s = now.getSeconds();
        var pct = ((h * 3600 + m * 60 + s) / 86400) * 100;
        fill.style.width = pct + "%";
    }
    _updateHSTFill();

    // ── Place chit icons at their time positions ────────────────────────────
    var chitPositions = [];
    if (chronoItems && chronoItems.length > 0) {
        chronoItems.forEach(function(item) {
            if (!item.start) return;
            var startDate = (item.start instanceof Date) ? item.start : new Date(item.start);
            var h = startDate.getHours(), m = startDate.getMinutes();
            var pct = ((h * 3600 + m * 60) / 86400) * 100;
            var icon = item.chit.status ? "☑️" : "🗓️";
            chitPositions.push({
                pct: pct,
                icon: icon,
                title: item.chit.title || "Untitled",
                chit: item.chit
            });
        });
    }

    // Sort chit positions by percentage for crowding detection
    chitPositions.sort(function(a, b) { return a.pct - b.pct; });

    // ── Crowding detection ──────────────────────────────────────────────────
    // If adjacent chit icons would be < 20px apart, collapse to vertical lines.
    // Bar width is 100% of container; we estimate pixel distance from percentage.
    var barWidth = bar.offsetWidth || contentEl.offsetWidth || 600;
    var crowded = false;
    for (var ci = 1; ci < chitPositions.length; ci++) {
        var pxDist = ((chitPositions[ci].pct - chitPositions[ci - 1].pct) / 100) * barWidth;
        if (pxDist < 20) {
            crowded = true;
            break;
        }
    }

    // ── Render chit markers ─────────────────────────────────────────────────
    chitPositions.forEach(function(pos) {
        var marker;
        if (crowded) {
            // Collapsed mode: vertical line
            marker = document.createElement("div");
            marker.className = "omni-hst-line";
            marker.style.left = pos.pct + "%";
            marker.title = pos.title;
        } else {
            // Icon mode
            marker = document.createElement("span");
            marker.className = "omni-hst-chit-icon";
            marker.style.left = pos.pct + "%";
            marker.textContent = pos.icon;
            marker.title = pos.title;
        }
        // Click → quick-edit
        (function(chit) {
            marker.addEventListener("click", function(e) {
                e.stopPropagation();
                if (typeof showQuickEditModal === "function") {
                    showQuickEditModal(chit, function() { displayChits(); });
                }
            });
        })(pos.chit);
        marker.style.cursor = "pointer";
        iconsLayer.appendChild(marker);
    });

    // ── Fetch and place weather icons ───────────────────────────────────────
    _placeOmniHSTWeather(iconsLayer);

    // ── Apply current HST mode visibility ───────────────────────────────────
    _applyHSTMode(iconsLayer);

    // ── Click bar to cycle mode: chits → both → weather → none → chits ─────
    bar.addEventListener("click", function(e) {
        if (e.target !== bar && e.target !== fill && e.target !== timeOverlay) return;
        var modes = ['chits', 'both', 'weather', 'none'];
        var idx = modes.indexOf(_omniHSTMode);
        _omniHSTMode = modes[(idx + 1) % modes.length];
        _applyHSTMode(iconsLayer);
    });

    // ── Set 1-second update interval for fill animation ─────────────────────
    if (_omniHSTInterval) { clearInterval(_omniHSTInterval); }
    _omniHSTInterval = setInterval(function() { _updateHSTFill(); _updateHSTTime(); }, 1000);
}

/**
 * Apply HST bar icon visibility based on _omniHSTMode.
 * Modes: 'chits' (chits only), 'both' (both), 'weather' (weather only), 'none' (neither)
 */
function _applyHSTMode(iconsLayer) {
    if (!iconsLayer) return;
    var chitIcons = iconsLayer.querySelectorAll('.omni-hst-chit-icon, .omni-hst-line');
    var weatherIcons = iconsLayer.querySelectorAll('.omni-hst-weather-icon');
    var showChits = (_omniHSTMode === 'chits' || _omniHSTMode === 'both');
    var showWeather = (_omniHSTMode === 'weather' || _omniHSTMode === 'both');
    chitIcons.forEach(function(el) { el.style.display = showChits ? '' : 'none'; });
    weatherIcons.forEach(function(el) { el.style.display = showWeather ? '' : 'none'; });
}

/**
 * Fetches hourly weather data and places weather icons on the HST bar.
 * Uses the default location from saved locations and the Open-Meteo hourly API.
 * Caches the result in localStorage to avoid repeated fetches.
 *
 * @param {HTMLElement} iconsLayer - The icons layer element to append weather icons to
 */
async function _placeOmniHSTWeather(iconsLayer) {
    if (!iconsLayer) return;

    // Check localStorage cache first
    var cacheKey = "cwoc_omni_hst_hourly";
    var cached = null;
    try {
        var raw = localStorage.getItem(cacheKey);
        if (raw) {
            cached = JSON.parse(raw);
            // Cache valid for 30 minutes
            if (cached && cached.ts && (Date.now() - cached.ts < 1800000) && cached.codes) {
                _renderHSTWeatherIcons(iconsLayer, cached.codes);
                return;
            }
        }
    } catch (e) { /* ignore */ }

    // Get default location
    var defaultLoc = (typeof getDefaultLocation === "function") ? getDefaultLocation() : null;
    if (!defaultLoc || !defaultLoc.address) return;

    try {
        var coords = await _geocodeAddress(defaultLoc.address);
        var lat = coords.lat, lon = coords.lon;

        // Fetch hourly weather codes for today
        var today = new Date().toISOString().slice(0, 10);
        var url = "https://api.open-meteo.com/v1/forecast?latitude=" + lat +
            "&longitude=" + lon +
            "&hourly=weathercode&timezone=auto&start_date=" + today +
            "&end_date=" + today;

        var resp = await fetch(url);
        if (!resp.ok) return;
        var data = await resp.json();
        if (!data || !data.hourly || !data.hourly.weathercode) return;

        var codes = data.hourly.weathercode; // Array of 24 weather codes (one per hour)

        // Cache the result
        try {
            localStorage.setItem(cacheKey, JSON.stringify({ codes: codes, ts: Date.now() }));
        } catch (e) { /* ignore */ }

        _renderHSTWeatherIcons(iconsLayer, codes);
    } catch (e) {
        // Silently fail — weather icons are optional
        console.error("[Omni HST] Weather fetch failed:", e);
    }
}

/**
 * Returns a human-readable weather condition name for a WMO weather code.
 * Uses the shared _weatherDescriptions from shared-utils.js.
 * @param {number} code - WMO weather code
 * @returns {string} Condition name
 */
function _getWeatherConditionName(code) {
    return (typeof _weatherDescriptions !== 'undefined' && _weatherDescriptions[code]) || 'Unknown';
}

/**
 * Renders weather icons on the HST bar at their hour positions.
 * Weather icons are always shown as icons (never collapsed to lines).
 *
 * @param {HTMLElement} iconsLayer - The icons layer element
 * @param {Array} codes - Array of 24 hourly weather codes
 */
function _renderHSTWeatherIcons(iconsLayer, codes) {
    if (!iconsLayer || !codes || !codes.length) return;

    // Only show weather icons for hours that haven't passed yet (or current hour)
    var currentHour = new Date().getHours();

    for (var hour = 0; hour < codes.length && hour < 24; hour++) {
        // Skip past hours (more than 1 hour ago)
        if (hour < currentHour - 1) continue;

        var code = codes[hour];
        if (code === null || code === undefined) continue;

        var icon = (typeof _getWeatherIcon === "function") ? _getWeatherIcon(code) : "❓";

        // Only show icon when weather changes from previous hour
        var prevCode = (hour > 0) ? codes[hour - 1] : null;
        var prevIcon = (prevCode !== null && prevCode !== undefined && typeof _getWeatherIcon === "function") ? _getWeatherIcon(prevCode) : null;
        if (prevIcon === icon && hour > currentHour - 1) continue;

        var pct = ((hour * 3600) / 86400) * 100;

        var weatherEl = document.createElement("span");
        weatherEl.className = "omni-hst-weather-icon";
        weatherEl.style.left = pct + "%";
        weatherEl.textContent = icon;

        // Build descriptive tooltip
        var timeLabel = (hour === 0 ? "12 AM" : hour < 12 ? hour + " AM" : hour === 12 ? "12 PM" : (hour - 12) + " PM");
        var conditionName = _getWeatherConditionName(code);
        weatherEl.title = timeLabel + " — " + conditionName;

        // Click → open weather modal
        weatherEl.addEventListener("click", function(e) {
            e.stopPropagation();
            if (typeof _openWeatherModal === "function") {
                _openWeatherModal();
            }
        });

        // Mobile long-press → open weather modal
        if (typeof enableLongPress === "function") {
            enableLongPress(weatherEl, function() {
                if (typeof _openWeatherModal === "function") {
                    _openWeatherModal();
                }
            });
        }

        iconsLayer.appendChild(weatherEl);
    }
}

/* ── Weather Bar ─────────────────────────────────────────────────────────── */

/**
 * Renders the Weather Bar: a compact strip showing current weather conditions.
 * Displays: conditions icon, current temp, high/low, and location name.
 * Clicking anywhere on the bar opens the weather modal.
 *
 * Uses the shared weather forecast cache (populated by prefetchSavedLocationWeather)
 * or fetches fresh data if cache is empty.
 *
 * @param {HTMLElement} contentEl - The section content container
 */
function _renderOmniWeather(contentEl) {
    if (!contentEl) return;
    contentEl.innerHTML = "";

    // Build the bar container (clickable)
    var bar = document.createElement("div");
    bar.className = "omni-weather-bar";
    bar.title = "Click for full weather details";
    bar.style.cursor = "pointer";
    bar.addEventListener("click", function() {
        if (typeof _openWeatherModal === "function") {
            _openWeatherModal();
        }
    });

    // Mobile long-press → open weather modal
    if (typeof enableLongPress === "function") {
        enableLongPress(bar, function() {
            if (typeof _openWeatherModal === "function") {
                _openWeatherModal();
            }
        });
    }

    // Show loading state initially
    bar.innerHTML = '<span class="omni-weather-loading">⏳ Loading weather…</span>';
    contentEl.appendChild(bar);

    // Get default location and fetch weather using the shared function
    var defaultLoc = (typeof getDefaultLocation === "function") ? getDefaultLocation() : null;
    if (!defaultLoc || !defaultLoc.address) {
        bar.innerHTML = '<span class="omni-weather-empty">No location configured</span>';
        return;
    }

    getWeatherForLocation(defaultLoc.address).then(function(wx) {
        if (!wx) {
            bar.innerHTML = '<span class="omni-weather-empty">Weather unavailable</span>';
            return;
        }
        var locationLabel = defaultLoc.label || defaultLoc.address;
        bar.innerHTML =
            '<span class="omni-weather-icon">' + wx.icon + '</span>' +
            wx.tempBarHtml +
            '<span class="omni-weather-location">' + _escHtml(locationLabel) + '</span>';
    });
}

// _escOmniHtml — now using shared _escHtml from shared-utils.js

/* ── HST + Weather Combo Section ──────────────────────────────────────────── */

/**
 * Renders a combined HST + Weather section with HST on the left and Weather on the right,
 * side by side in a single row.
 *
 * @param {HTMLElement} contentEl - The section content container
 * @param {Array} chronoItems - Chrono items for the HST bar
 */
function _renderOmniHSTWeatherCombo(contentEl, chronoItems) {
    if (!contentEl) return;
    contentEl.innerHTML = "";

    var comboWrapper = document.createElement("div");
    comboWrapper.className = "omni-hst-weather-combo";

    // Left side: HST bar
    var hstSide = document.createElement("div");
    hstSide.className = "omni-combo-hst";
    if (typeof _renderOmniHST === 'function') {
        _renderOmniHST(hstSide, chronoItems);
    }
    comboWrapper.appendChild(hstSide);

    // Right side: Weather bar
    var weatherSide = document.createElement("div");
    weatherSide.className = "omni-combo-weather";
    if (typeof _renderOmniWeather === 'function') {
        _renderOmniWeather(weatherSide);
    }
    comboWrapper.appendChild(weatherSide);

    contentEl.appendChild(comboWrapper);
}

/* ── HST Weather Strip Section ────────────────────────────────────────────── */

/**
 * Renders the HST Weather Strip: the normal HST bar with a temperature
 * color strip inside it at the bottom, below the HST fill.
 * Each of the 100 HST segments gets a color from the temperature gradient
 * based on the interpolated hourly forecast.
 *
 * @param {HTMLElement} contentEl - The section content container
 * @param {Array} chronoItems - Chrono items for the HST bar
 */
function _renderOmniHSTTempStrip(contentEl, chronoItems) {
    if (!contentEl) return;
    contentEl.innerHTML = "";

    // Render the normal HST bar
    _renderOmniHST(contentEl, chronoItems);

    // Find the HST bar element that was just rendered and inject the temp strip inside it
    var hstBar = contentEl.querySelector('.omni-hst-bar');
    if (!hstBar) return;

    // Make the bar taller to accommodate the strip
    hstBar.classList.add('omni-hst-bar-with-temp');

    // Create the temperature strip inside the bar at the bottom
    var tempStrip = document.createElement("div");
    tempStrip.className = "omni-hst-temp-strip";
    hstBar.appendChild(tempStrip);

    // Fetch hourly temperatures and render the strip
    _populateHSTTempStrip(tempStrip);
}

/**
 * Fetches hourly temperature data and renders 100 colored segments.
 * Each segment's color is interpolated from the hourly forecast using _getTempColor.
 *
 * @param {HTMLElement} stripEl - The temperature strip container
 */
async function _populateHSTTempStrip(stripEl) {
    if (!stripEl) return;

    var defaultLoc = (typeof getDefaultLocation === "function") ? getDefaultLocation() : null;
    if (!defaultLoc || !defaultLoc.address) return;

    try {
        var coords = await _geocodeAddress(defaultLoc.address);
        var lat = coords.lat, lon = coords.lon;

        // Use local date for the query
        var now = new Date();
        var today = now.getFullYear() + '-' +
            String(now.getMonth() + 1).padStart(2, '0') + '-' +
            String(now.getDate()).padStart(2, '0');

        // Check cache
        var cacheKey = 'cwoc_hst_temp_strip_' + today;
        var cached = null;
        try {
            cached = JSON.parse(localStorage.getItem(cacheKey));
            if (cached && cached.temps && (Date.now() - cached.ts < 3600000)) {
                _renderTempStripSegments(stripEl, cached.temps);
                return;
            }
        } catch (e) { /* no cache */ }

        // Fetch hourly temperatures
        var url = 'https://api.open-meteo.com/v1/forecast?latitude=' + lat +
            '&longitude=' + lon +
            '&hourly=temperature_2m&timezone=auto&start_date=' + today +
            '&end_date=' + today;

        var resp = await fetch(url);
        if (!resp.ok) return;
        var data = await resp.json();
        if (!data || !data.hourly || !data.hourly.temperature_2m) return;

        var hourlyTemps = data.hourly.temperature_2m; // 24 values (one per hour, in Celsius)

        // Cache it
        try { localStorage.setItem(cacheKey, JSON.stringify({ temps: hourlyTemps, ts: Date.now() })); } catch (e) {}

        _renderTempStripSegments(stripEl, hourlyTemps);
    } catch (e) {
        console.warn('[HSTTempStrip] Failed to fetch hourly temps:', e);
    }
}

/**
 * Renders 100 colored segments in the temperature strip.
 * Interpolates between hourly temperature values to get a temp for each HST segment.
 *
 * @param {HTMLElement} stripEl - The strip container
 * @param {Array} hourlyTemps - 24 hourly temperature values in Celsius
 */
function _renderTempStripSegments(stripEl, hourlyTemps) {
    if (!stripEl || !hourlyTemps || hourlyTemps.length === 0) return;
    stripEl.innerHTML = '';

    // Store hourly temps on the element for tooltip access
    stripEl._hourlyTemps = hourlyTemps;

    // Build 100 color stops, each blending from previous to next
    var colors = [];
    for (var seg = 0; seg < 100; seg++) {
        var dayFraction = seg / 100;
        var hourFloat = dayFraction * 24;
        var hourLow = Math.floor(hourFloat);
        var hourHigh = Math.min(hourLow + 1, 23);
        var frac = hourFloat - hourLow;
        var tempLow = hourlyTemps[hourLow] !== undefined ? hourlyTemps[hourLow] : 15;
        var tempHigh = hourlyTemps[hourHigh] !== undefined ? hourlyTemps[hourHigh] : tempLow;
        var tempC = tempLow + frac * (tempHigh - tempLow);
        colors.push((typeof _getTempColor === 'function') ? _getTempColor(tempC) : '#888');
    }

    // Build a smooth gradient: each segment's midpoint is its color,
    // blending from the previous segment's color to the next
    var stops = [];
    for (var i = 0; i < colors.length; i++) {
        var pct = ((i + 0.5) / 100 * 100).toFixed(2);
        stops.push(colors[i] + ' ' + pct + '%');
    }
    stripEl.style.background = 'linear-gradient(to right, ' + stops.join(', ') + ')';

    // Add hover tooltip
    stripEl.style.cursor = 'crosshair';
    stripEl.addEventListener('mousemove', function(e) {
        var rect = stripEl.getBoundingClientRect();
        var x = e.clientX - rect.left;
        var pctX = x / rect.width;
        var hourFloat = pctX * 24;
        var hourLow = Math.floor(hourFloat);
        var hourHigh = Math.min(hourLow + 1, 23);
        var frac = hourFloat - hourLow;
        var tLow = hourlyTemps[hourLow] !== undefined ? hourlyTemps[hourLow] : 15;
        var tHigh = hourlyTemps[hourHigh] !== undefined ? hourlyTemps[hourHigh] : tLow;
        var tempC = tLow + frac * (tHigh - tLow);

        var displayTemp = (typeof _convertTemp === 'function') ? _convertTemp(tempC) : Math.round(tempC);
        var unit = (typeof _tempUnit === 'function') ? _tempUnit() : '°C';

        // Format time
        var totalMinutes = Math.round(pctX * 1440);
        var h = Math.floor(totalMinutes / 60);
        var m = totalMinutes % 60;
        var timeStr = String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
        if (typeof _globalFmtTime === 'function') {
            timeStr = _globalFmtTime(timeStr);
        } else if (typeof _sharedFmtTime === 'function') {
            timeStr = _sharedFmtTime(timeStr);
        }

        // HST value
        var hstVal = (pctX * 100).toFixed(1) + ' sd';

        stripEl.title = displayTemp + unit + ' at ' + timeStr + ' (' + hstVal + ')';
    });

    stripEl.addEventListener('mouseleave', function() {
        stripEl.title = '';
    });
}

/* ── Pinned Notes Section ─────────────────────────────────────────────────── */

/**
 * Renders the Pinned Notes section: pinned chits that qualify as notes
 * (have content, no dates, no checklist). Reuses the same card structure
 * as displayNotesView() in main-views-notes.js.
 *
 * @param {HTMLElement} contentEl - The section content container
 * @param {Array} pinnedNotes - Array of chit objects (already filtered by deduplication)
 * @param {Object} viSettings - Visual indicator settings
 */
function _renderOmniPinnedNotes(contentEl, pinnedNotes, viSettings) {
    if (!pinnedNotes || pinnedNotes.length === 0) return;

    pinnedNotes.forEach(function(chit) {
        var chitElement = document.createElement("div");
        chitElement.className = "chit-card";
        chitElement.dataset.chitId = chit.id;
        applyChitColors(chitElement, chitColor(chit));
        if (chit.archived) chitElement.classList.add("archived-chit");
        if (_isDeclinedByCurrentUser(chit)) chitElement.classList.add("declined-chit");

        // ── Title row with icons (same pattern as Notes view) ───────────────
        var titleRow = document.createElement("div");
        titleRow.style.cssText = "display:flex;align-items:center;gap:0.3em;font-weight:bold;margin-bottom:0.2em;";

        if (chit.pinned) {
            var pinIcon = document.createElement('i');
            pinIcon.className = 'fas fa-bookmark';
            pinIcon.title = 'Click to unpin';
            pinIcon.style.fontSize = '0.85em';
            pinIcon.style.cursor = 'pointer';
            (function(c, icon) {
                icon.addEventListener('click', function(e) {
                    e.stopPropagation();
                    fetch('/api/chits/' + c.id, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(Object.assign({}, c, { pinned: false }))
                    }).then(function(r) { if (r.ok) { fetchChits(); } });
                });
            })(chit, pinIcon);
            titleRow.appendChild(pinIcon);
        }
        if (chit.archived) {
            var archIcon = document.createElement('span');
            archIcon.textContent = '📦';
            archIcon.title = 'Archived';
            titleRow.appendChild(archIcon);
        }
        if (chit.snoozed_until && new Date(chit.snoozed_until) > new Date()) {
            var snoozeIcon = document.createElement('span');
            snoozeIcon.textContent = '😴';
            snoozeIcon.title = 'Snoozed until ' + new Date(chit.snoozed_until).toLocaleString();
            titleRow.appendChild(snoozeIcon);
        }
        // Stealth indicator
        if (chit.stealth) {
            var _stealthUser = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
            if (_stealthUser && chit.owner_id === _stealthUser.user_id) {
                var stealthIcon = document.createElement('span');
                stealthIcon.textContent = '🥷';
                stealthIcon.title = 'Stealth — hidden from other users';
                stealthIcon.className = 'cwoc-stealth-indicator';
                titleRow.appendChild(stealthIcon);
            }
        }
        // Alert indicators
        if (typeof _getAllIndicators === 'function') {
            var indicators = _getAllIndicators(chit, viSettings, 'card');
            if (indicators) {
                var indSpan = document.createElement('span');
                indSpan.className = 'alert-indicators';
                indSpan.textContent = indicators;
                titleRow.appendChild(indSpan);
            }
        }

        var titleSpan = document.createElement('span');
        titleSpan.textContent = chit.title || '(Untitled)';
        titleRow.appendChild(titleSpan);

        // Owner badge
        if (chit.owner_display_name) {
            var _curUser = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
            if (!_curUser || chit.owner_display_name !== _curUser.display_name) {
                var ownerBadge = document.createElement('span');
                ownerBadge.className = 'cwoc-owner-badge';
                ownerBadge.textContent = '👤 ' + chit.owner_display_name;
                ownerBadge.title = 'Owner: ' + chit.owner_display_name;
                titleRow.appendChild(ownerBadge);
            }
        }

        // Assignee badge
        if (chit.assigned_to_display_name) {
            var assigneeBadge = document.createElement('span');
            assigneeBadge.className = 'cwoc-assignee-badge';
            assigneeBadge.textContent = '📌 ' + chit.assigned_to_display_name;
            assigneeBadge.title = 'Assigned to: ' + chit.assigned_to_display_name;
            titleRow.appendChild(assigneeBadge);
        }

        chitElement.appendChild(titleRow);

        // ── Note content (markdown rendered) ────────────────────────────────
        var noteEl = document.createElement("div");
        noteEl.className = "note-content";
        noteEl.style.cssText = "overflow-y:auto;";
        if (typeof marked !== "undefined" && chit.note) {
            noteEl.innerHTML = resolveChitLinks(marked.parse(chit.note, { breaks: true }), chits);
        } else {
            noteEl.style.whiteSpace = "pre-wrap";
            noteEl.textContent = chit.note;
        }
        chitElement.appendChild(noteEl);

        // ── Interactions ────────────────────────────────────────────────────
        // Double-click: open in editor
        chitElement.addEventListener("dblclick", function() {
            storePreviousState();
            window.location.href = '/editor?id=' + chit.id;
        });

        // Single click on note text: inline edit
        noteEl.addEventListener("click", function(e) {
            if (e.shiftKey) return;
            e.stopPropagation();
            if (_isViewerRole(chit)) return;
            if (noteEl.contentEditable === 'true') return;

            noteEl.contentEditable = 'true';
            noteEl.style.outline = '2px solid #8b4513';
            noteEl.style.borderRadius = '4px';
            noteEl.style.padding = '6px';
            noteEl.style.whiteSpace = 'pre-wrap';
            noteEl.style.maxHeight = 'none';
            noteEl.style.overflow = 'visible';
            noteEl.style.userSelect = 'text';
            chitElement.style.cursor = 'auto';
            chitElement.style.overflow = 'visible';
            chitElement.style.userSelect = 'text';
            noteEl.textContent = chit.note || '';
            noteEl.focus();

            var saveEdit = function() {
                noteEl.contentEditable = 'false';
                noteEl.style.outline = '';
                noteEl.style.padding = '';
                noteEl.style.maxHeight = '';
                noteEl.style.overflow = '';
                noteEl.style.userSelect = '';
                chitElement.style.cursor = '';
                chitElement.style.overflow = '';
                chitElement.style.userSelect = '';
                var newNote = noteEl.textContent;
                if (newNote !== chit.note) {
                    fetch('/api/chits/' + chit.id, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(Object.assign({}, chit, { note: newNote }))
                    }).then(function(r) { if (r.ok) { chit.note = newNote; fetchChits(); } });
                } else {
                    if (typeof marked !== 'undefined' && chit.note) {
                        noteEl.innerHTML = resolveChitLinks(marked.parse(chit.note, { breaks: true }), chits);
                    }
                }
            };
            noteEl.addEventListener('blur', saveEdit, { once: true });
            noteEl.addEventListener('keydown', function(ke) {
                if (ke.key === 'Escape') { ke.preventDefault(); noteEl.blur(); }
            });
        });

        // Shift+click: quick-edit modal
        chitElement.addEventListener("click", function(e) {
            if (!e.shiftKey) return;
            e.preventDefault();
            if (typeof showQuickEditModal === 'function' && !_isViewerRole(chit)) {
                showQuickEditModal(chit, function() { displayChits(); });
            }
        });

        // Right-click: context menu
        chitElement.addEventListener("contextmenu", function(e) {
            e.preventDefault();
            if (typeof _showChitContextMenu === 'function' && !_isViewerRole(chit)) {
                _showChitContextMenu(e, chit, function() { displayChits(); });
            }
        });

        contentEl.appendChild(chitElement);
    });
}

/* ── Pinned Checklists Section ─────────────────────────────────────────────── */

/**
 * Renders the Pinned Checklists section: pinned chits that have checklist items.
 * Reuses the same card structure as displayChecklistView() in main-views.js,
 * including _buildChitHeader() for the header and renderInlineChecklist() from
 * shared-checklist.js for interactive inline checklist toggling.
 *
 * @param {HTMLElement} contentEl - The section content container
 * @param {Array} pinnedChecklists - Array of chit objects (already filtered by deduplication)
 * @param {Object} viSettings - Visual indicator settings
 */
function _renderOmniPinnedChecklists(contentEl, pinnedChecklists, viSettings) {
    if (!pinnedChecklists || pinnedChecklists.length === 0) return;

    pinnedChecklists.forEach(function(chit) {
        var chitElement = document.createElement("div");
        chitElement.className = "chit-card";
        chitElement.dataset.chitId = chit.id;
        applyChitColors(chitElement, chitColor(chit));
        if (chit.archived) chitElement.classList.add("archived-chit");
        if (_isDeclinedByCurrentUser(chit)) chitElement.classList.add("declined-chit");

        // ── Header (reuse _buildChitHeader with checklistCount) ─────────────
        var titleHtml = '<a href="/editor?id=' + chit.id + '">' + (chit.title || '(Untitled)') + '</a>';
        chitElement.appendChild(_buildChitHeader(chit, titleHtml, viSettings, { checklistCount: true, skipMapIcon: true }));

        // Pin icon click → unpin
        var _pinEl = chitElement.querySelector('.fa-bookmark');
        if (_pinEl) {
            _pinEl.style.cursor = 'pointer';
            _pinEl.title = 'Click to unpin';
            (function(c, icon) {
                icon.addEventListener('click', function(e) {
                    e.stopPropagation();
                    fetch('/api/chits/' + c.id, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(Object.assign({}, c, { pinned: false }))
                    }).then(function(r) { if (r.ok) { fetchChits(); } });
                });
            })(chit, _pinEl);
        }

        // ── Strike out title when all checklist items are checked ────────────
        var _clNonEmpty = (chit.checklist || []).filter(function(i) { return i && i.text && i.text.trim(); });
        var _clAllChecked = _clNonEmpty.length > 0 && _clNonEmpty.every(function(i) { return i.checked || i.done; });
        if (_clAllChecked) chitElement.classList.add('checklist-all-done');

        // ── Interactive checklist (inline toggle) ───────────────────────────
        if (!_isViewerRole(chit)) {
            renderInlineChecklist(chitElement, chit, function() { fetchChits(); });
        } else {
            // Read-only checklist display for viewers — only show unchecked items
            var roList = document.createElement('div');
            roList.style.cssText = 'opacity:0.8;font-size:0.9em;';
            (chit.checklist || []).forEach(function(item) {
                if (item.checked || item.done) return;
                var row = document.createElement('div');
                row.style.cssText = 'padding:2px 0;';
                var rowText = document.createElement('span');
                rowText.textContent = '☐ ';
                row.appendChild(rowText);
                var rowMd = document.createElement('span');
                renderChecklistItemMarkdown(rowMd, item.text || item.label || '');
                row.appendChild(rowMd);
                roList.appendChild(row);
            });
            chitElement.appendChild(roList);
        }

        // ── Interactions ────────────────────────────────────────────────────
        // Double-click: open in editor
        chitElement.addEventListener("dblclick", function() {
            storePreviousState();
            window.location.href = '/editor?id=' + chit.id;
        });

        // Shift+click: quick-edit modal
        chitElement.addEventListener("click", function(e) {
            if (!e.shiftKey) return;
            e.preventDefault();
            if (typeof showQuickEditModal === 'function' && !_isViewerRole(chit)) {
                showQuickEditModal(chit, function() { displayChits(); });
            }
        });

        // Right-click: context menu
        chitElement.addEventListener("contextmenu", function(e) {
            e.preventDefault();
            if (typeof _showChitContextMenu === 'function' && !_isViewerRole(chit)) {
                _showChitContextMenu(e, chit, function() { displayChits(); });
            }
        });

        contentEl.appendChild(chitElement);
    });
}

/* ── Email Section ───────────────────────────────────────────────────────── */

/** Page size for email pagination (loaded from settings) */
var _OMNI_EMAIL_PAGE_SIZE = 3;

/**
 * Renders the Omni Email section: unread emails from Omni-enabled bundles,
 * paginated 3 at a time with "Previous 3" / "Next 3" navigation.
 *
 * Reuses _buildEmailCard(chit, viSettings) from main-email.js for card rendering.
 * Swipe handlers are already built into _buildEmailCard.
 *
 * @param {HTMLElement} contentEl - The section content container
 * @param {Array} allEmailChits - All email chits from deduplication (may include read/non-Omni)
 */
function _renderOmniEmail(contentEl, allEmailChits) {
    console.log('[OmniEmail] _renderOmniEmail ENTER');
    console.log('[OmniEmail] contentEl:', !!contentEl);
    console.log('[OmniEmail] allEmailChits:', allEmailChits ? allEmailChits.length : 'NULL/undefined');
    if (!contentEl) return;
    contentEl.innerHTML = "";

    // Load page size from settings
    var settings = window._cwocSettings || {};
    _OMNI_EMAIL_PAGE_SIZE = parseInt(settings.omni_email_count, 10) || 3;

    var viSettings = (window._cwocSettings || {}).visual_indicators || {};

    // Get Omni-enabled bundles
    var omniBundles = _getOmniEnabledBundles();
    console.log('[OmniEmail] omniBundles count:', omniBundles ? omniBundles.length : 'NULL');
    console.log('[OmniEmail] omniBundles:', JSON.stringify((omniBundles || []).map(function(b) { return { id: b.id, name: b.name, omni_view: b.omni_view }; })));

    // If no Omni-enabled bundles, nothing to show — hide section
    if (!omniBundles || omniBundles.length === 0) {
        console.log('[OmniEmail] NO Omni-enabled bundles — hiding section');
        var sectionEl = contentEl.parentElement;
        if (sectionEl) sectionEl.style.display = "none";
        return;
    }

    // Build the set of Omni bundle tag names for fast lookup
    var omniBundleTags = omniBundles.map(function(b) {
        return 'CWOC_System/Bundle/' + b.name;
    });
    // Check if any Omni-enabled bundle is the catch-all (non-removable / "Everything Else")
    var hasCatchAll = omniBundles.some(function(b) {
        return b.removable === 0 || b.removable === false || b.removable === '0' || b.name === 'Everything Else';
    });
    console.log('[OmniEmail] omniBundleTags:', JSON.stringify(omniBundleTags), 'hasCatchAll:', hasCatchAll);

    // Filter: email_message_id present, email_read === false, tags include an Omni-enabled bundle
    var unreadOmniEmails = (allEmailChits || []).filter(function(chit) {
        if (!chit.email_message_id) return false;
        if (chit.email_read) return false;

        // Check if any tag matches an Omni-enabled bundle
        var tags = chit.tags || [];
        if (typeof tags === 'string') {
            try { tags = JSON.parse(tags); } catch (e) { return false; }
        }

        // Check if email has a matching bundle tag
        var matchesNamedBundle = tags.some(function(t) {
            var tagName = (typeof t === 'string') ? t : (t && t.name ? t.name : '');
            return omniBundleTags.indexOf(tagName) !== -1;
        });
        if (matchesNamedBundle) return true;

        // If catch-all bundle is Omni-enabled, include emails with NO bundle tag
        if (hasCatchAll) {
            var hasAnyBundleTag = tags.some(function(t) {
                var tagName = (typeof t === 'string') ? t : (t && t.name ? t.name : '');
                return tagName.indexOf('CWOC_System/Bundle/') === 0;
            });
            if (!hasAnyBundleTag) return true;
        }

        return false;
    });
    console.log('[OmniEmail] unreadOmniEmails after filter:', unreadOmniEmails.length);

    // Log first few email chits for debugging tag matching
    if (allEmailChits && allEmailChits.length > 0) {
        var sample = allEmailChits.slice(0, 5);
        sample.forEach(function(chit, i) {
            var tags = chit.tags || [];
            if (typeof tags === 'string') { try { tags = JSON.parse(tags); } catch(e) { tags = []; } }
            console.log('[OmniEmail] Sample email[' + i + ']: id=' + chit.id + ', email_read=' + chit.email_read + ', subject=' + (chit.title || '').substring(0, 40) + ', tags=' + JSON.stringify(tags).substring(0, 200));
        });
    }

    // Sort by email_date descending (most recent first)
    unreadOmniEmails.sort(function(a, b) {
        var dateA = a.email_date ? new Date(a.email_date) : new Date(0);
        var dateB = b.email_date ? new Date(b.email_date) : new Date(0);
        return dateB - dateA;
    });

    // If no unread emails from Omni bundles, hide section
    if (unreadOmniEmails.length === 0) {
        var sectionEl = contentEl.parentElement;
        if (sectionEl) sectionEl.style.display = "none";
        return;
    }

    // Paginate: slice [page*3, page*3+3]
    var startIdx = _omniEmailPage * _OMNI_EMAIL_PAGE_SIZE;
    var endIdx = startIdx + _OMNI_EMAIL_PAGE_SIZE;
    var pageEmails = unreadOmniEmails.slice(startIdx, endIdx);

    // Render email cards
    var cardsContainer = document.createElement("div");
    cardsContainer.className = "omni-email-cards";
    pageEmails.forEach(function(chit) {
        var card = _buildEmailCard(chit, viSettings);
        cardsContainer.appendChild(card);
    });
    contentEl.appendChild(cardsContainer);

    // Pagination buttons
    var hasPrev = _omniEmailPage > 0;
    var hasNext = endIdx < unreadOmniEmails.length;

    if (hasPrev || hasNext) {
        var paginationRow = document.createElement("div");
        paginationRow.className = "omni-email-pagination";

        if (hasPrev) {
            var prevBtn = document.createElement("button");
            prevBtn.type = "button";
            prevBtn.className = "omni-email-page-btn";
            prevBtn.textContent = "← Previous 3";
            prevBtn.addEventListener("click", function() {
                _omniEmailPage--;
                _renderOmniEmail(contentEl, allEmailChits);
            });
            paginationRow.appendChild(prevBtn);
        }

        if (hasNext) {
            var nextBtn = document.createElement("button");
            nextBtn.type = "button";
            nextBtn.className = "omni-email-page-btn";
            nextBtn.textContent = "Next 3 →";
            nextBtn.addEventListener("click", function() {
                _omniEmailPage++;
                _renderOmniEmail(contentEl, allEmailChits);
            });
            paginationRow.appendChild(nextBtn);
        }

        contentEl.appendChild(paginationRow);
    }

    // Show count indicator
    var countEl = document.createElement("div");
    countEl.className = "omni-email-count";
    countEl.textContent = (startIdx + 1) + "–" + Math.min(endIdx, unreadOmniEmails.length) +
        " of " + unreadOmniEmails.length + " unread";
    contentEl.appendChild(countEl);
}

/**
 * Returns the list of Omni-enabled bundles from the cached bundles data.
 * Falls back to fetching from settings if _emailBundlesData is not yet loaded.
 *
 * @returns {Array} Array of bundle objects where omni_view === 1
 */
function _getOmniEnabledBundles() {
    // Try cached bundles data first (from main-email-bundles.js)
    var bundles = (typeof _emailBundlesData !== 'undefined' && _emailBundlesData)
        ? _emailBundlesData
        : null;

    console.log('[OmniEmail] _getOmniEnabledBundles: _emailBundlesData=' + (_emailBundlesData ? _emailBundlesData.length + ' items' : 'null/undefined'));

    // Fallback: try settings cache
    if (!bundles && window._cwocSettings && window._cwocSettings.bundles) {
        bundles = window._cwocSettings.bundles;
        console.log('[OmniEmail] _getOmniEnabledBundles: fell back to _cwocSettings.bundles=' + bundles.length + ' items');
    }

    if (!bundles || !Array.isArray(bundles)) {
        console.log('[OmniEmail] _getOmniEnabledBundles: NO bundles data at all');
        return [];
    }

    console.log('[OmniEmail] _getOmniEnabledBundles: all bundles omni_view values:', JSON.stringify(bundles.map(function(b) { return { name: b.name, omni_view: b.omni_view, omni_view_type: typeof b.omni_view }; })));

    var filtered = bundles.filter(function(b) {
        return !!b.omni_view && b.omni_view !== 0 && b.omni_view !== '0';
    });
    console.log('[OmniEmail] _getOmniEnabledBundles: filtered to', filtered.length, 'Omni-enabled bundles');
    return filtered;
}

/* ── Filter Lock ─────────────────────────────────────────────────────────── */

/**
 * On Omni View entry: reset sidebar filters to clean state, or apply locked
 * defaults if omni_locked_filters is set in settings.
 *
 * If locked defaults are present, programmatically sets the sidebar filter UI
 * to match the saved state and shows a 🔒 indicator.
 * If no locked defaults, clears all filters to a fresh state.
 *
 * Called once per Omni View entry (guarded by _omniFiltersApplied flag).
 */
function _applyOmniEntryFilters() {
    var settings = window._cwocSettings || {};
    var lockedRaw = settings.omni_locked_filters;
    var locked = null;

    if (lockedRaw) {
        try {
            locked = (typeof lockedRaw === 'string') ? JSON.parse(lockedRaw) : lockedRaw;
        } catch (e) {
            console.error('[Omni] Failed to parse omni_locked_filters:', e);
            locked = null;
        }
    }

    if (locked && typeof locked === 'object') {
        // Apply locked defaults to sidebar
        _applyLockedFiltersToSidebar(locked);
        _omniLockedFilters = locked;
        _showOmniLockedIndicator(true);
    } else {
        // No locked defaults — clear all filters to clean state
        _clearAllFilters();
        _omniLockedFilters = null;
        _showOmniLockedIndicator(false);
    }

    // Always enable "Show Email (Received)" for Omni View so email chits are included
    var showEmailRecvCb = document.getElementById('show-email-received');
    if (showEmailRecvCb && !showEmailRecvCb.checked) {
        showEmailRecvCb.checked = true;
    }
}

/**
 * Programmatically applies a saved filter state to the sidebar UI elements.
 * Structure: { statuses: [...], tags: [...], priorities: [...], people: [...], text: "..." }
 *
 * @param {Object} locked - The locked filter state object
 */
function _applyLockedFiltersToSidebar(locked) {
    // ── Statuses ────────────────────────────────────────────────────────────
    var statusContainer = document.getElementById('status-multi');
    if (statusContainer) {
        // Uncheck all status checkboxes first
        statusContainer.querySelectorAll('input[type="checkbox"]').forEach(function(cb) { cb.checked = false; });

        if (locked.statuses && locked.statuses.length > 0) {
            // Check the specific statuses
            locked.statuses.forEach(function(val) {
                var cb = statusContainer.querySelector('input[data-filter="status"][value="' + val + '"]');
                if (cb) cb.checked = true;
            });
            // Uncheck "Any" since specific filters are active
            var anyCb = statusContainer.querySelector('input[data-any="true"]');
            if (anyCb) anyCb.checked = false;
        } else {
            // No status filter — check "Any"
            var anyCb = statusContainer.querySelector('input[data-any="true"]');
            if (anyCb) anyCb.checked = true;
        }
    }

    // ── Priorities ──────────────────────────────────────────────────────────
    var priorityContainer = document.getElementById('priority-multi');
    if (priorityContainer) {
        priorityContainer.querySelectorAll('input[type="checkbox"]').forEach(function(cb) { cb.checked = false; });

        if (locked.priorities && locked.priorities.length > 0) {
            locked.priorities.forEach(function(val) {
                var cb = priorityContainer.querySelector('input[data-filter="priority"][value="' + val + '"]');
                if (cb) cb.checked = true;
            });
            var anyCb = priorityContainer.querySelector('input[data-any="true"]');
            if (anyCb) anyCb.checked = false;
        } else {
            var anyCb = priorityContainer.querySelector('input[data-any="true"]');
            if (anyCb) anyCb.checked = true;
        }
    }

    // ── Tags ────────────────────────────────────────────────────────────────
    if (locked.tags && locked.tags.length > 0) {
        // Set the tag selection array and sync checkboxes
        window._sidebarTagSelection = locked.tags.slice();
        var labelContainer = document.getElementById('label-multi');
        if (labelContainer && typeof _syncSidebarTagCheckboxes === 'function' && typeof _cachedTagObjects !== 'undefined') {
            _syncSidebarTagCheckboxes(labelContainer, _cachedTagObjects);
        }
    } else {
        window._sidebarTagSelection = [];
        var labelContainer = document.getElementById('label-multi');
        if (labelContainer) {
            labelContainer.querySelectorAll('input[type="checkbox"]').forEach(function(cb) { cb.checked = false; });
        }
        _cwocUpdateTagVirtualOptions();
    }

    // ── People ──────────────────────────────────────────────────────────────
    if (locked.people && locked.people.length > 0) {
        window._sidebarPeopleSelection = locked.people.slice();
        if (window._cachedPeopleContacts && typeof _renderPeopleFilterPanel === 'function') {
            _renderPeopleFilterPanel(window._cachedPeopleContacts);
        }
    } else {
        if (window._sidebarPeopleSelection) window._sidebarPeopleSelection.length = 0;
        if (window._cachedPeopleContacts && typeof _renderPeopleFilterPanel === 'function') {
            _renderPeopleFilterPanel(window._cachedPeopleContacts);
        }
    }

    // ── Text search ─────────────────────────────────────────────────────────
    var searchEl = document.getElementById('search');
    if (searchEl) {
        searchEl.value = (locked.text && typeof locked.text === 'string') ? locked.text : '';
    }
}

/**
 * Shows or hides the 🔒 locked-filters indicator in the sidebar.
 * Creates the indicator element if it doesn't exist yet.
 *
 * @param {boolean} show - Whether to show the indicator
 */
function _showOmniLockedIndicator(show) {
    var indicator = document.getElementById('omni-locked-indicator');

    if (show) {
        if (!indicator) {
            // Create the indicator near the filter section header
            indicator = document.createElement('span');
            indicator.id = 'omni-locked-indicator';
            indicator.className = 'omni-locked-indicator';
            indicator.textContent = '🔒';
            indicator.title = 'Omni View locked filter defaults active';

            // Insert near the search/filter area
            var searchEl = document.getElementById('search');
            if (searchEl && searchEl.parentElement) {
                searchEl.parentElement.appendChild(indicator);
            }
        }
        indicator.style.display = '';
    } else {
        if (indicator) {
            indicator.style.display = 'none';
        }
    }
}

/**
 * Gathers the current sidebar filter state and saves it to backend settings
 * as `omni_locked_filters`. These become the default filters applied each time
 * the user enters the Omni View.
 */
async function _lockOmniFilters() {
    // 1. Gather current filter state from sidebar UI
    var statuses = [];
    var statusContainer = document.getElementById('status-multi');
    if (statusContainer) {
        statusContainer.querySelectorAll('input[data-filter="status"]:checked').forEach(function(cb) {
            statuses.push(cb.value);
        });
    }

    var tags = (window._sidebarTagSelection || []).slice();

    var priorities = [];
    var priorityContainer = document.getElementById('priority-multi');
    if (priorityContainer) {
        priorityContainer.querySelectorAll('input[data-filter="priority"]:checked').forEach(function(cb) {
            priorities.push(cb.value);
        });
    }

    var people = (window._sidebarPeopleSelection || []).slice();

    var searchEl = document.getElementById('search');
    var text = (searchEl && searchEl.value) ? searchEl.value.trim() : '';

    // 2. Build filter state object
    var filterState = {
        statuses: statuses,
        tags: tags,
        priorities: priorities,
        people: people,
        text: text
    };

    // 3. Save to backend via POST /api/settings
    var currentUser = (typeof getCurrentUser === 'function') ? getCurrentUser() : null;
    var currentUserId = currentUser ? currentUser.user_id : null;
    if (!currentUserId) {
        console.error('[Omni] Cannot lock filters: no current user ID');
        cwocToast('Failed to save filter defaults', 'error');
        return;
    }

    var payload = Object.assign({}, window._cwocSettings || {}, {
        user_id: currentUserId,
        omni_locked_filters: JSON.stringify(filterState)
    });

    try {
        var response = await fetch('/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error('Server returned ' + response.status);
        }

        // 4. Update local settings cache
        if (window._cwocSettings) {
            window._cwocSettings.omni_locked_filters = JSON.stringify(filterState);
        }
        _omniLockedFilters = filterState;

        // 5. Show toast confirmation and locked indicator
        cwocToast('Filters saved as Omni defaults', 'success');
        _showOmniLockedIndicator(true);

    } catch (e) {
        console.error('[Omni] Failed to save locked filters:', e);
        cwocToast('Failed to save filter defaults', 'error');
    }
}

/* ── Lock Filters Button (Sidebar) ───────────────────────────────────────── */

/**
 * Shows the 🔒 "Lock Filters" button in the sidebar filter section header row.
 * Only visible when Omni View is active. Clicking it calls _lockOmniFilters().
 * Creates the button dynamically if it doesn't exist; shows it if it does.
 */
function _showOmniLockBtn() {
    var btn = document.getElementById('omni-lock-btn');
    if (btn) {
        btn.style.display = '';
        return;
    }

    // Find the filter section header row (same flex container as Clear/Defaults buttons)
    var clearBtn = document.getElementById('sidebar-clear-all-btn');
    if (!clearBtn || !clearBtn.parentElement) return;
    var headerRow = clearBtn.parentElement;

    // Create the lock button (same style as Clear/Defaults buttons)
    btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'omni-lock-btn';
    btn.className = 'action-button sidebar-compact-btn omni-lock-btn';
    btn.title = 'Save current filters as Omni View defaults';
    btn.style.cssText = 'margin-bottom:0;flex-shrink:0;font-size:0.75em;padding:4px 8px;';
    btn.innerHTML = '🔒&nbsp;Lock';
    btn.addEventListener('click', function(e) {
        e.stopPropagation();
        if (typeof _lockOmniFilters === 'function') {
            _lockOmniFilters();
        }
    });

    headerRow.appendChild(btn);
}

/**
 * Hides the 🔒 "Lock Filters" button in the sidebar.
 * Called when leaving Omni View (switching to any other tab).
 */
function _hideOmniLockBtn() {
    var btn = document.getElementById('omni-lock-btn');
    if (btn) {
        btn.style.display = 'none';
    }
}
