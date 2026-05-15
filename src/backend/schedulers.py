"""Weather update service for the CWOC backend.

Provides weather fetching, geocoding, chit partitioning, and background
scheduler tasks for automatic weather updates.
"""

import asyncio
import json
import logging
import sqlite3
import time
import urllib.request
import urllib.parse
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo, available_timezones

from src.backend.db import DB_PATH, _update_lock, serialize_json_field
from src.backend.cron_parser import parse_cron, matches


logger = logging.getLogger(__name__)


# --- Server base URL helper (for Ntfy click URLs) ---

_cached_base_url = None

def _get_server_base_url():
    """Get the server's HTTPS base URL for building click URLs in notifications.
    Caches the result after first call."""
    global _cached_base_url
    if _cached_base_url:
        return _cached_base_url
    import socket
    try:
        local_ip = socket.gethostbyname(socket.gethostname())
        if local_ip.startswith("127."):
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(("8.8.8.8", 80))
            local_ip = s.getsockname()[0]
            s.close()
    except Exception:
        local_ip = "localhost"
    _cached_base_url = f"https://{local_ip}"
    return _cached_base_url


# --- Push notification helper (graceful if pywebpush unavailable) ---

def _send_chit_push(owner_id, chit_id, chit_title, time_label, time_value):
    """Send a push notification for a chit event to the chit owner.

    Imports send_push_to_user from the push routes module. If pywebpush
    is not installed or the import fails, logs a warning and returns silently.

    Args:
        owner_id: User ID of the chit owner.
        chit_id: The chit's UUID.
        chit_title: Display title for the notification.
        time_label: One of "Alarm at", "Starts at", or "Due at".
        time_value: Human-readable time string (e.g. "3:00 PM").
    """
    try:
        from src.backend.routes.push import send_push_to_user
    except ImportError:
        logger.debug("Push routes not available — skipping push notification")
        return
    except Exception as e:
        logger.debug(f"Could not import push routes: {e}")
        return

    payload = {
        "title": chit_title or "CWOC Reminder",
        "body": f"{time_label} {time_value}",
        "icon": "/static/cwoc-icon-192.png",
        "badge": "/static/cwoc-icon-192.png",
        "data": {
            "chit_id": chit_id,
            "url": f"/frontend/html/editor.html?id={chit_id}",
        },
    }

    try:
        result = send_push_to_user(owner_id, payload)
        if result.get("sent", 0) > 0:
            logger.info(f"Push sent for chit {chit_id} to user {owner_id}: {result}")
        elif result.get("error"):
            logger.debug(f"Push skipped for chit {chit_id}: {result.get('error')}")
    except Exception as e:
        logger.warning(f"Push notification failed for chit {chit_id}: {e}")


# --- Ntfy notification helper (parallel channel to web push) ---

def _send_chit_ntfy(owner_id, chit_id, chit_title, time_label, time_value):
    """Send an ntfy notification for a chit event to the chit owner.

    Imports send_ntfy_notification from the ntfy routes module and sends
    a notification with the chit title, time info, and a click URL to the
    chit editor. Failures are caught and logged — never propagated.

    Args:
        owner_id: User ID of the chit owner.
        chit_id: The chit's UUID.
        chit_title: Display title for the notification.
        time_label: One of "Starts at" or "Due at".
        time_value: Human-readable time string (e.g. "3:00 PM").
    """
    try:
        from src.backend.routes.ntfy import send_ntfy_notification, build_ntfy_actions, get_user_snooze_minutes
    except ImportError:
        logger.debug("Ntfy routes not available — skipping ntfy notification")
        return
    except Exception as e:
        logger.debug(f"Could not import ntfy routes: {e}")
        return

    try:
        title = chit_title if chit_title else "CWOC Reminder"
        body = f"{time_label} {time_value}"
        base = _get_server_base_url()
        click_url = f"{base}/frontend/html/editor.html?id={chit_id}"
        icon_url = f"{base}/static/cwoc-icon-192.png"

        # Set priority and tags based on alert type
        if "Alarm" in time_label:
            tags = "alarm_clock"
            priority = 5  # urgent — long vibration, pop-over
        elif "Timer" in time_label:
            tags = "timer_clock"
            priority = 5  # urgent
        elif "Reminder" in time_label:
            tags = "bell"
            priority = 5  # max — persistent notification
        else:
            tags = "calendar"
            priority = 5  # max — persistent notification

        # Build action buttons (Open, Snooze, Dismiss)
        snooze_minutes = get_user_snooze_minutes(owner_id)
        actions = build_ntfy_actions(base, chit_id=chit_id, source_type="chit",
                                     snooze_minutes=snooze_minutes)

        result = send_ntfy_notification(
            user_id=owner_id,
            title=title,
            body=body,
            click_url=click_url,
            tags=tags,
            priority=priority,
            icon_url=icon_url,
            actions=actions,
        )
        if result.get("sent"):
            logger.info(f"Ntfy sent for chit {chit_id} to user {owner_id}: {result}")
        else:
            logger.debug(f"Ntfy skipped for chit {chit_id}: {result.get('reason')}")
    except Exception as e:
        logger.warning(f"Ntfy notification failed for chit {chit_id}: {e}")


# --- Timezone-aware alert computation helpers ---

def compute_alert_utc(wall_clock_naive: datetime, tz_name: str) -> datetime:
    """Convert a naive wall-clock datetime to UTC using the given timezone.

    Handles DST gaps by advancing to the first valid minute after the gap.
    Handles DST ambiguity (fall-back) by selecting the first occurrence (fold=0).

    Args:
        wall_clock_naive: A naive datetime representing the intended wall-clock time.
        tz_name: An IANA timezone name (e.g., "America/Denver").

    Returns:
        A timezone-aware datetime in UTC representing the absolute fire moment.
    """
    tz = ZoneInfo(tz_name)
    # Localize with fold=0 to select the first occurrence during fall-back ambiguity
    localized = wall_clock_naive.replace(tzinfo=tz, fold=0)

    # Check for DST spring-forward gap: if the time doesn't exist, the UTC offset
    # applied will be wrong. We detect this by round-tripping through UTC and back.
    # If the round-trip produces a different wall-clock time, we're in a gap.
    utc_dt = localized.astimezone(timezone.utc)
    round_tripped = utc_dt.astimezone(tz)

    if round_tripped.replace(tzinfo=None) != wall_clock_naive:
        # We're in a DST gap — the time doesn't exist.
        # Advance to the first valid minute after the gap.
        # The round-tripped time (with fold=0 -> pre-transition offset) gives us
        # the post-transition local time. The start of the post-transition period
        # is the first valid instant. We use the round-tripped time's offset to
        # find the gap boundary: the first valid instant is the transition point itself.
        # With fold=0 in a gap, Python applies the pre-transition (standard) offset,
        # so round_tripped is the actual wall-clock time that results. The first valid
        # minute after the gap is when the new offset begins.
        # Strategy: try fold=1 which uses the post-transition offset — this gives
        # us the correct UTC for the "would-be" time if it existed in the new offset.
        # But the requirement says advance to the FIRST valid minute (e.g., 3:00 AM).
        # We find this by localizing with fold=1 and then converting back.
        localized_post = wall_clock_naive.replace(tzinfo=tz, fold=1)
        utc_post = localized_post.astimezone(timezone.utc)
        local_post = utc_post.astimezone(tz)
        # The first valid minute after the gap: take the round-tripped time from fold=1
        # which gives us the correct post-transition interpretation. But we need the
        # actual gap boundary. The gap boundary is where the offset changes.
        # Simpler approach: walk forward minute by minute from the requested time
        # until we find a time that round-trips correctly.
        candidate = wall_clock_naive
        for _ in range(120):  # Max 2 hours of gap (covers all real-world DST gaps)
            candidate = candidate + timedelta(minutes=1)
            cand_localized = candidate.replace(tzinfo=tz, fold=0)
            cand_utc = cand_localized.astimezone(timezone.utc)
            cand_rt = cand_utc.astimezone(tz)
            if cand_rt.replace(tzinfo=None) == candidate:
                # Found the first valid minute
                return cand_utc
        # Fallback: shouldn't happen, but return the post-transition interpretation
        return utc_post

    return utc_dt


def get_user_current_timezone(user_id: str) -> str:
    """Resolve the user's current timezone from settings.

    Precedence: timezone_override (if set) → default_timezone → 'UTC' fallback.

    Args:
        user_id: The user's ID to look up settings for.

    Returns:
        A valid IANA timezone string.
    """
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute(
            "SELECT timezone_override, default_timezone FROM settings WHERE user_id = ?",
            (user_id,)
        )
        row = cursor.fetchone()
        conn.close()

        if row:
            override = row[0]
            default_tz = row[1]
            if override and override.strip():
                return override.strip()
            if default_tz and default_tz.strip():
                return default_tz.strip()
    except Exception as e:
        logger.error(f"get_user_current_timezone error for user '{user_id}': {e}")

    return "UTC"


# --- Timezone-aware recurrence expansion helpers ---

def resolve_recurrence_timezone(chit_timezone: str, user_id: str) -> str:
    """Resolve the effective timezone for recurrence expansion.

    - Anchored chits (chit_timezone is non-null): use chit's timezone if recognized,
      otherwise fall back to user's default timezone.
    - Floating chits (chit_timezone is None/empty): use user's current timezone.

    Args:
        chit_timezone: The chit's stored timezone field (may be None or invalid).
        user_id: The user's ID for looking up their current timezone.

    Returns:
        A valid IANA timezone string to use for expansion.
    """
    if chit_timezone and chit_timezone.strip():
        tz_name = chit_timezone.strip()
        if tz_name in available_timezones():
            return tz_name
        # Unrecognized timezone: fall back to user's default timezone
        logger.warning(
            f"Unrecognized timezone '{tz_name}' for recurrence expansion, "
            f"falling back to user's default timezone"
        )
    # Floating chit or unrecognized timezone: use user's current timezone
    return get_user_current_timezone(user_id)


def _localize_wall_clock(wall_clock_naive: datetime, tz_name: str) -> datetime:
    """Localize a naive wall-clock datetime in the given timezone.

    Handles DST gaps by shifting forward to the first valid instant.
    Handles DST ambiguity (fall-back) by selecting the first occurrence (fold=0).

    Args:
        wall_clock_naive: A naive datetime representing the intended wall-clock time.
        tz_name: An IANA timezone name.

    Returns:
        A timezone-aware datetime in the given timezone.
    """
    tz = ZoneInfo(tz_name)
    # Localize with fold=0 to select the first occurrence during fall-back ambiguity
    localized = wall_clock_naive.replace(tzinfo=tz, fold=0)

    # Check for DST spring-forward gap by round-tripping through UTC
    utc_dt = localized.astimezone(timezone.utc)
    round_tripped = utc_dt.astimezone(tz)

    if round_tripped.replace(tzinfo=None) != wall_clock_naive:
        # We're in a DST gap — advance to the first valid minute after the gap
        candidate = wall_clock_naive
        for _ in range(120):  # Max 2 hours (covers all real-world DST gaps)
            candidate = candidate + timedelta(minutes=1)
            cand_localized = candidate.replace(tzinfo=tz, fold=0)
            cand_utc = cand_localized.astimezone(timezone.utc)
            cand_rt = cand_utc.astimezone(tz)
            if cand_rt.replace(tzinfo=None) == candidate:
                return cand_localized
        # Fallback: return the round-tripped result (already past the gap)
        return round_tripped

    return localized


def _advance_wall_clock(base_naive: datetime, freq: str, interval: int,
                        occurrence_index: int) -> datetime:
    """Advance a naive datetime by the given frequency and interval for daily+ recurrences.

    Preserves wall-clock time (hour:minute) while advancing the date components.
    Does NOT handle DST — caller must localize the result.

    Args:
        base_naive: The base naive datetime (starting point).
        freq: One of 'DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'.
        interval: The recurrence interval (e.g., every 2 days).
        occurrence_index: Which occurrence to compute (0 = base, 1 = first recurrence, etc.)

    Returns:
        A naive datetime with the date advanced but time preserved.
    """
    if occurrence_index == 0:
        return base_naive

    year = base_naive.year
    month = base_naive.month
    day = base_naive.day

    if freq == 'DAILY':
        result = base_naive + timedelta(days=interval * occurrence_index)
        # Preserve the original time components (timedelta on naive datetime is fine)
        return result.replace(hour=base_naive.hour, minute=base_naive.minute,
                              second=base_naive.second)
    elif freq == 'WEEKLY':
        result = base_naive + timedelta(weeks=interval * occurrence_index)
        return result.replace(hour=base_naive.hour, minute=base_naive.minute,
                              second=base_naive.second)
    elif freq == 'MONTHLY':
        # Advance month by interval * occurrence_index
        total_months = (year * 12 + (month - 1)) + (interval * occurrence_index)
        new_year = total_months // 12
        new_month = (total_months % 12) + 1
        # Clamp day to max days in the target month
        import calendar
        max_day = calendar.monthrange(new_year, new_month)[1]
        new_day = min(day, max_day)
        return base_naive.replace(year=new_year, month=new_month, day=new_day)
    elif freq == 'YEARLY':
        new_year = year + (interval * occurrence_index)
        # Handle Feb 29 in non-leap years
        import calendar
        if month == 2 and day == 29 and not calendar.isleap(new_year):
            return base_naive.replace(year=new_year, month=2, day=28)
        return base_naive.replace(year=new_year)
    else:
        # Unknown frequency — treat as daily
        result = base_naive + timedelta(days=interval * occurrence_index)
        return result.replace(hour=base_naive.hour, minute=base_naive.minute,
                              second=base_naive.second)


def expand_occurrence_tz_aware(base_dt: datetime, tz_name: str, freq: str,
                               interval: int, occurrence_index: int) -> datetime:
    """Expand a single recurrence occurrence in the given timezone.

    For DAILY/WEEKLY/MONTHLY/YEARLY: preserves wall-clock time in the timezone.
    For HOURLY/MINUTELY: maintains uniform elapsed-time intervals (UTC-based).

    DST gap: shifts forward to first valid instant.
    DST ambiguity: selects first occurrence (fold=0).

    Args:
        base_dt: A naive datetime representing the base occurrence's wall-clock time
                 in the given timezone.
        tz_name: An IANA timezone name for expansion.
        freq: Recurrence frequency — 'MINUTELY', 'HOURLY', 'DAILY', 'WEEKLY',
              'MONTHLY', or 'YEARLY'.
        interval: The recurrence interval (e.g., every 2 hours, every 3 days).
        occurrence_index: Which occurrence to compute (0 = base, 1 = first recurrence, etc.)

    Returns:
        A timezone-aware datetime representing the occurrence in the given timezone.
    """
    freq_upper = freq.upper() if freq else 'DAILY'

    if freq_upper in ('HOURLY', 'MINUTELY'):
        # Sub-daily: maintain uniform elapsed-time intervals (UTC-based)
        # First, localize the base datetime to get the absolute UTC starting point
        base_localized = _localize_wall_clock(base_dt, tz_name)
        base_utc = base_localized.astimezone(timezone.utc)

        # Advance by absolute duration in UTC
        if freq_upper == 'HOURLY':
            delta = timedelta(hours=interval * occurrence_index)
        else:  # MINUTELY
            delta = timedelta(minutes=interval * occurrence_index)

        result_utc = base_utc + delta
        # Convert back to the expansion timezone for display
        tz = ZoneInfo(tz_name)
        return result_utc.astimezone(tz)

    else:
        # Daily+: preserve wall-clock time across DST transitions
        # Advance the date components while keeping hour:minute:second the same
        advanced_naive = _advance_wall_clock(base_dt, freq_upper, interval, occurrence_index)
        # Localize in the timezone (handles DST gap/ambiguity)
        return _localize_wall_clock(advanced_naive, tz_name)


# --- Helper — get chit focus date ---

def _get_chit_focus_date(chit):
    """Return the earliest date from start_datetime or due_datetime as YYYY-MM-DD.
    Returns None if neither field has a value."""
    dates = []
    for field in ("start_datetime", "due_datetime"):
        val = chit.get(field) if isinstance(chit, dict) else getattr(chit, field, None)
        if val and isinstance(val, str) and val.strip():
            try:
                # Parse ISO datetime and extract date portion
                dt = datetime.fromisoformat(val.replace("Z", "+00:00"))
                dates.append(dt.date())
            except (ValueError, TypeError):
                # Try parsing just the date portion (first 10 chars)
                try:
                    dt = datetime.strptime(val[:10], "%Y-%m-%d")
                    dates.append(dt.date())
                except (ValueError, TypeError):
                    pass
    if not dates:
        return None
    return min(dates).isoformat()


# --- Helper — partition eligible chits ---

def _partition_eligible_chits(chits, now):
    """Partition chits into hourly (0-7 days) and daily (8-16 days) buckets.
    Filters: non-deleted, non-empty location, has a focus_date in range.
    For recurring chits whose original date is in the past, uses today as the
    focus date so they get fresh weather updates.
    Returns (hourly_chits, daily_chits)."""
    today = now.date() if hasattr(now, 'date') else now
    hourly_chits = []
    daily_chits = []
    for chit in chits:
        # Check deleted flag
        deleted = chit.get("deleted") if isinstance(chit, dict) else getattr(chit, "deleted", None)
        if deleted:
            continue
        # Check location
        location = chit.get("location") if isinstance(chit, dict) else getattr(chit, "location", None)
        if not location or not str(location).strip():
            continue
        # Get focus date
        focus_date_str = _get_chit_focus_date(chit)
        if not focus_date_str:
            continue
        try:
            focus_date = datetime.strptime(focus_date_str, "%Y-%m-%d").date()
        except (ValueError, TypeError):
            continue
        delta_days = (focus_date - today).days

        # For recurring chits whose original date is in the past, use today
        # so they get fresh weather data for the current occurrence
        if delta_days < 0:
            has_recurrence = False
            recurrence_raw = chit.get("recurrence") if isinstance(chit, dict) else getattr(chit, "recurrence", None)
            if recurrence_raw:
                try:
                    rec = json.loads(recurrence_raw) if isinstance(recurrence_raw, str) else recurrence_raw
                    if rec and rec.get("freq"):
                        has_recurrence = True
                except (json.JSONDecodeError, TypeError, AttributeError):
                    pass
            if has_recurrence:
                # Override focus date to today for weather fetching
                if isinstance(chit, dict):
                    chit["_weather_focus_date"] = today.isoformat()
                hourly_chits.append(chit)
                continue
            # Non-recurring past chit — skip
            continue

        if 0 <= delta_days <= 7:
            hourly_chits.append(chit)
        elif 8 <= delta_days <= 16:
            daily_chits.append(chit)
    return hourly_chits, daily_chits


# --- Helper — extract weather for a specific date ---

def _extract_weather_for_date(forecast_daily, focus_date):
    """Extract weather data for a specific date from an Open-Meteo daily response.
    Returns a weather_data dict or None if focus_date not found."""
    times = forecast_daily.get("time", [])
    try:
        idx = times.index(focus_date)
    except ValueError:
        return None
    return {
        "focus_date": focus_date,
        "updated_time": datetime.utcnow().isoformat() + "Z",
        "high": forecast_daily.get("temperature_2m_max", [])[idx] if idx < len(forecast_daily.get("temperature_2m_max", [])) else None,
        "low": forecast_daily.get("temperature_2m_min", [])[idx] if idx < len(forecast_daily.get("temperature_2m_min", [])) else None,
        "precipitation": forecast_daily.get("precipitation_sum", [])[idx] if idx < len(forecast_daily.get("precipitation_sum", [])) else None,
        "weather_code": forecast_daily.get("weathercode", [])[idx] if idx < len(forecast_daily.get("weathercode", [])) else None,
        "wind_gusts": forecast_daily.get("wind_gusts_10m_max", [])[idx] if idx < len(forecast_daily.get("wind_gusts_10m_max", [])) else None,
        "wind_speed": forecast_daily.get("wind_speed_10m_max", [])[idx] if idx < len(forecast_daily.get("wind_speed_10m_max", [])) else None,
    }


# --- Weather fetch helpers ---

def _sync_weather_fetch(url):
    """Blocking fetch for Open-Meteo data — runs in thread pool."""
    req = urllib.request.Request(url, headers={"User-Agent": "CWOC-Weather/1.0"})
    with urllib.request.urlopen(req, timeout=15) as resp:
        return json.loads(resp.read().decode())


async def _fetch_weather_for_location(lat, lon, days=16):
    """Fetch multi-day forecast from Open-Meteo for a given lat/lon.
    Returns parsed JSON response."""
    url = (
        f"https://api.open-meteo.com/v1/forecast"
        f"?latitude={lat}&longitude={lon}"
        f"&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_gusts_10m_max,wind_speed_10m_max"
        f"&timezone=auto&forecast_days={days}"
    )
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _sync_weather_fetch, url)


# --- Internal geocode helper (uses geocode cache/lock from health routes) ---

async def _geocode_address(address):
    """Geocode an address string, reusing the geocode cache and rate limiting from health routes.
    Returns {"lat": float, "lon": float} or None on failure."""
    from src.backend.routes.health import _geocode_cache, _geocode_lock, _geocode_last_req, _sync_geocode_fetch
    import src.backend.routes.health as _health_mod

    key = address.lower().strip()
    # Return cached result if < 24 hours old
    if key in _geocode_cache and (time.time() - _geocode_cache[key]["ts"]) < 86400:
        return {"lat": _geocode_cache[key]["lat"], "lon": _geocode_cache[key]["lon"]}

    async with _geocode_lock:
        # Re-check cache after acquiring lock
        if key in _geocode_cache and (time.time() - _geocode_cache[key]["ts"]) < 86400:
            return {"lat": _geocode_cache[key]["lat"], "lon": _geocode_cache[key]["lon"]}

        # Rate-limit: wait if less than 1.1 seconds since last request
        elapsed = time.time() - _health_mod._geocode_last_req
        if elapsed < 1.1:
            await asyncio.sleep(1.1 - elapsed)

        url = "https://nominatim.openstreetmap.org/search?format=json&limit=3&q=" + urllib.parse.quote(address)
        try:
            _health_mod._geocode_last_req = time.time()
            loop = asyncio.get_event_loop()
            data = await loop.run_in_executor(None, _sync_geocode_fetch, url)
            if data and len(data) > 0:
                lat = float(data[0]["lat"])
                lon = float(data[0]["lon"])
                _geocode_cache[key] = {"lat": lat, "lon": lon, "ts": time.time()}
                return {"lat": lat, "lon": lon}
            return None
        except Exception as e:
            logger.error(f"Geocode error for '{address}': {e}")
            return None


# --- POST /api/weather/update endpoint handler ---

async def weather_update():
    """Trigger weather update for all eligible chits."""
    # Prevent concurrent runs
    if _update_lock.locked():
        return {"updated": 0, "skipped": 0, "message": "Update already in progress"}

    async with _update_lock:
        start_time = time.time()
        updated = 0
        skipped = 0

        try:
            # Query all non-deleted chits with location and date fields
            conn = sqlite3.connect(DB_PATH)
            cursor = conn.cursor()
            cursor.execute(
                "SELECT * FROM chits WHERE (deleted = 0 OR deleted IS NULL) "
                "AND location IS NOT NULL AND location != '' "
                "AND (start_datetime IS NOT NULL OR due_datetime IS NOT NULL)"
            )
            rows = cursor.fetchall()
            columns = [col[0] for col in cursor.description]
            all_chits = [dict(zip(columns, row)) for row in rows]
            conn.close()

            # Partition into hourly and daily buckets
            now = datetime.utcnow()
            hourly_chits, daily_chits = _partition_eligible_chits(all_chits, now)
            eligible_chits = hourly_chits + daily_chits

            if not eligible_chits:
                elapsed = time.time() - start_time
                return {"updated": 0, "skipped": 0, "elapsed_seconds": round(elapsed, 2)}

            # Group chits by unique location string
            location_groups = {}
            for chit in eligible_chits:
                loc = (chit.get("location") or "").strip()
                if loc:
                    location_groups.setdefault(loc, []).append(chit)

            # Geocode each unique location once
            location_coords = {}
            for loc in location_groups:
                try:
                    coords = await _geocode_address(loc)
                    if coords:
                        location_coords[loc] = coords
                    else:
                        logger.warning(f"Weather update: geocode failed for '{loc}'")
                        skipped += len(location_groups[loc])
                except Exception as e:
                    logger.error(f"Weather update: geocode error for '{loc}': {e}")
                    skipped += len(location_groups[loc])

            # Fetch 16-day forecast per unique location
            location_forecasts = {}
            for loc, coords in location_coords.items():
                try:
                    forecast = await _fetch_weather_for_location(coords["lat"], coords["lon"], days=16)
                    if forecast and "daily" in forecast:
                        location_forecasts[loc] = forecast["daily"]
                    else:
                        logger.warning(f"Weather update: no daily data for '{loc}'")
                        skipped += len(location_groups[loc])
                except Exception as e:
                    logger.error(f"Weather update: forecast fetch error for '{loc}': {e}")
                    skipped += len(location_groups[loc])

            # Update each chit's weather_data
            conn = sqlite3.connect(DB_PATH)
            cursor = conn.cursor()
            for loc, chits_for_loc in location_groups.items():
                if loc not in location_forecasts:
                    continue
                forecast_daily = location_forecasts[loc]
                for chit in chits_for_loc:
                    # For recurring chits with past dates, use today's date (set by _partition_eligible_chits)
                    focus_date_str = chit.get("_weather_focus_date") or _get_chit_focus_date(chit)
                    if not focus_date_str:
                        skipped += 1
                        continue
                    weather_data = _extract_weather_for_date(forecast_daily, focus_date_str)
                    if weather_data:
                        try:
                            cursor.execute(
                                "UPDATE chits SET weather_data = ?, modified_datetime = ? WHERE id = ?",
                                (serialize_json_field(weather_data), datetime.utcnow().isoformat(), chit["id"])
                            )
                            updated += 1
                        except Exception as e:
                            logger.error(f"Weather update: DB write error for chit {chit['id']}: {e}")
                            skipped += 1
                    else:
                        skipped += 1
            conn.commit()
            conn.close()

        except Exception as e:
            logger.error(f"Weather update error: {e}")

        elapsed = time.time() - start_time
        return {"updated": updated, "skipped": skipped, "elapsed_seconds": round(elapsed, 2)}


# --- Background scheduler tasks ---

async def _weather_hourly_loop():
    """Background task: update weather for chits in the 0-7 day window every 60 minutes."""
    while True:
        try:
            await asyncio.sleep(3600)  # 60 minutes
            if _update_lock.locked():
                logger.info("Weather hourly loop: update already in progress, skipping")
                continue
            async with _update_lock:
                logger.info("Weather hourly loop: starting update")
                conn = sqlite3.connect(DB_PATH)
                cursor = conn.cursor()
                cursor.execute(
                    "SELECT * FROM chits WHERE (deleted = 0 OR deleted IS NULL) "
                    "AND location IS NOT NULL AND location != '' "
                    "AND (start_datetime IS NOT NULL OR due_datetime IS NOT NULL)"
                )
                rows = cursor.fetchall()
                columns = [col[0] for col in cursor.description]
                all_chits = [dict(zip(columns, row)) for row in rows]
                conn.close()

                now = datetime.utcnow()
                hourly_chits, _ = _partition_eligible_chits(all_chits, now)
                if not hourly_chits:
                    logger.info("Weather hourly loop: no eligible chits")
                    continue

                location_groups = {}
                for chit in hourly_chits:
                    loc = (chit.get("location") or "").strip()
                    if loc:
                        location_groups.setdefault(loc, []).append(chit)

                for loc, chits_for_loc in location_groups.items():
                    try:
                        coords = await _geocode_address(loc)
                        if not coords:
                            continue
                        forecast = await _fetch_weather_for_location(coords["lat"], coords["lon"], days=7)
                        if not forecast or "daily" not in forecast:
                            continue
                        forecast_daily = forecast["daily"]
                        conn = sqlite3.connect(DB_PATH)
                        cursor = conn.cursor()
                        for chit in chits_for_loc:
                            # For recurring chits with past dates, use today's date
                            focus_date_str = chit.get("_weather_focus_date") or _get_chit_focus_date(chit)
                            if not focus_date_str:
                                continue
                            weather_data = _extract_weather_for_date(forecast_daily, focus_date_str)
                            if weather_data:
                                cursor.execute(
                                    "UPDATE chits SET weather_data = ?, modified_datetime = ? WHERE id = ?",
                                    (serialize_json_field(weather_data), datetime.utcnow().isoformat(), chit["id"])
                                )
                        conn.commit()
                        conn.close()
                    except Exception as e:
                        logger.error(f"Weather hourly loop error for '{loc}': {e}")
                logger.info("Weather hourly loop: update complete")
        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.error(f"Weather hourly loop unexpected error: {e}")


async def _weather_daily_loop():
    """Background task: update weather for chits in the 8-16 day window every 24 hours."""
    while True:
        try:
            await asyncio.sleep(86400)  # 24 hours
            if _update_lock.locked():
                logger.info("Weather daily loop: update already in progress, skipping")
                continue
            async with _update_lock:
                logger.info("Weather daily loop: starting update")
                conn = sqlite3.connect(DB_PATH)
                cursor = conn.cursor()
                cursor.execute(
                    "SELECT * FROM chits WHERE (deleted = 0 OR deleted IS NULL) "
                    "AND location IS NOT NULL AND location != '' "
                    "AND (start_datetime IS NOT NULL OR due_datetime IS NOT NULL)"
                )
                rows = cursor.fetchall()
                columns = [col[0] for col in cursor.description]
                all_chits = [dict(zip(columns, row)) for row in rows]
                conn.close()

                now = datetime.utcnow()
                _, daily_chits = _partition_eligible_chits(all_chits, now)
                if not daily_chits:
                    logger.info("Weather daily loop: no eligible chits")
                    continue

                location_groups = {}
                for chit in daily_chits:
                    loc = (chit.get("location") or "").strip()
                    if loc:
                        location_groups.setdefault(loc, []).append(chit)

                for loc, chits_for_loc in location_groups.items():
                    try:
                        coords = await _geocode_address(loc)
                        if not coords:
                            continue
                        forecast = await _fetch_weather_for_location(coords["lat"], coords["lon"], days=16)
                        if not forecast or "daily" not in forecast:
                            continue
                        forecast_daily = forecast["daily"]
                        conn = sqlite3.connect(DB_PATH)
                        cursor = conn.cursor()
                        for chit in chits_for_loc:
                            # For recurring chits with past dates, use today's date
                            focus_date_str = chit.get("_weather_focus_date") or _get_chit_focus_date(chit)
                            if not focus_date_str:
                                continue
                            weather_data = _extract_weather_for_date(forecast_daily, focus_date_str)
                            if weather_data:
                                cursor.execute(
                                    "UPDATE chits SET weather_data = ?, modified_datetime = ? WHERE id = ?",
                                    (serialize_json_field(weather_data), datetime.utcnow().isoformat(), chit["id"])
                                )
                        conn.commit()
                        conn.close()
                    except Exception as e:
                        logger.error(f"Weather daily loop error for '{loc}': {e}")
                logger.info("Weather daily loop: update complete")
        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.error(f"Weather daily loop unexpected error: {e}")


def _get_habit_cycle_end(chit, now):
    """Calculate the end-of-cycle datetime for a habit chit's current period.

    Returns a datetime representing midnight at the end of the current cycle,
    or None if the frequency can't be determined.
    """
    # Get frequency from recurrence_rule or habit_reset_period
    recurrence_raw = chit.get("recurrence")
    freq = None
    if recurrence_raw:
        try:
            rec = json.loads(recurrence_raw) if isinstance(recurrence_raw, str) else recurrence_raw
            if rec and rec.get("freq"):
                freq = rec["freq"]
        except (json.JSONDecodeError, TypeError, AttributeError):
            pass
    if not freq:
        freq = chit.get("habit_reset_period") or "DAILY"

    if freq == "DAILY":
        return datetime(now.year, now.month, now.day) + timedelta(days=1)
    elif freq == "WEEKLY":
        # End of week (next Monday midnight by default — matches JS wsd=1 default)
        days_until_end = (7 - now.weekday()) % 7 or 7
        return datetime(now.year, now.month, now.day) + timedelta(days=days_until_end)
    elif freq == "MONTHLY":
        # First of next month
        if now.month == 12:
            return datetime(now.year + 1, 1, 1)
        return datetime(now.year, now.month + 1, 1)
    elif freq == "YEARLY":
        return datetime(now.year + 1, 1, 1)
    return None


# ═══════════════════════════════════════════════════════════════════════════
# Timezone change — floating alert recalculation
# ═══════════════════════════════════════════════════════════════════════════

def recalculate_floating_alerts(user_id: str):
    """Recalculate all pending floating chit alerts after a timezone change.

    When the user's current timezone changes, floating chit alerts (timezone IS NULL)
    need their fire times recomputed in the new timezone. If any recalculated fire
    time falls in the past, the alert is fired immediately.

    Anchored chit alerts (timezone IS NOT NULL) are NOT affected by timezone changes.

    This function is designed to be called from a background task and completes
    within 60 seconds of the timezone change being detected.

    Args:
        user_id: The user whose timezone changed.
    """
    try:
        new_tz = get_user_current_timezone(user_id)
        now_utc = datetime.now(timezone.utc)

        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        # Query all non-deleted floating chits (timezone IS NULL) with alerts
        # that belong to this user and have future-relevant dates
        cursor.execute(
            "SELECT id, title, start_datetime, end_datetime, due_datetime, "
            "       point_in_time, alerts, status, habit, habit_goal, habit_success "
            "FROM chits "
            "WHERE (deleted = 0 OR deleted IS NULL) "
            "AND owner_id = ? "
            "AND (timezone IS NULL OR timezone = '') "
            "AND alerts IS NOT NULL AND alerts != '' AND alerts != '[]'",
            (user_id,)
        )
        rows = cursor.fetchall()
        columns = [col[0] for col in cursor.description]
        floating_chits = [dict(zip(columns, row)) for row in rows]
        conn.close()

        if not floating_chits:
            logger.info(f"recalculate_floating_alerts: no floating chits with alerts for user '{user_id}'")
            return

        fired_count = 0

        for chit in floating_chits:
            chit_id = chit.get("id")
            chit_title = chit.get("title") or "CWOC Reminder"
            start_dt = chit.get("start_datetime")
            end_dt = chit.get("end_datetime")
            due_dt = chit.get("due_datetime")
            point_in_time_dt = chit.get("point_in_time")

            # Check start_datetime fire time
            if start_dt:
                try:
                    start_naive = datetime.fromisoformat(start_dt.replace("Z", "").split("+")[0])
                    start_utc = compute_alert_utc(start_naive, new_tz)
                    if start_utc <= now_utc:
                        # Fire time is in the past — fire immediately
                        try:
                            time_str = start_naive.strftime("%I:%M %p").lstrip("0")
                        except (ValueError, TypeError):
                            time_str = start_dt
                        _send_chit_push(user_id, chit_id, chit_title, "Starts at", time_str)
                        try:
                            _send_chit_ntfy(user_id, chit_id, chit_title, "Starts at", time_str)
                        except Exception as e:
                            logger.warning(f"Ntfy failed for recalc start {chit_id}: {e}")
                        fired_count += 1
                except Exception as e:
                    logger.warning(f"recalculate_floating_alerts: error processing start_dt for chit {chit_id}: {e}")

            # Check due_datetime fire time
            if due_dt:
                try:
                    due_naive = datetime.fromisoformat(due_dt.replace("Z", "").split("+")[0])
                    due_utc = compute_alert_utc(due_naive, new_tz)
                    if due_utc <= now_utc:
                        try:
                            time_str = due_naive.strftime("%I:%M %p").lstrip("0")
                        except (ValueError, TypeError):
                            time_str = due_dt
                        _send_chit_push(user_id, chit_id, chit_title, "Due at", time_str)
                        try:
                            _send_chit_ntfy(user_id, chit_id, chit_title, "Due at", time_str)
                        except Exception as e:
                            logger.warning(f"Ntfy failed for recalc due {chit_id}: {e}")
                        fired_count += 1
                except Exception as e:
                    logger.warning(f"recalculate_floating_alerts: error processing due_dt for chit {chit_id}: {e}")

            # Check notification-type alerts
            alerts_raw = chit.get("alerts")
            if not alerts_raw:
                continue
            try:
                alerts = json.loads(alerts_raw) if isinstance(alerts_raw, str) else alerts_raw
            except (json.JSONDecodeError, TypeError):
                continue
            if not isinstance(alerts, list):
                continue

            for idx, alert in enumerate(alerts):
                alert_type = alert.get("_type")

                # Only process notification-type alerts (alarms are time-of-day based, not affected)
                if alert_type != "notification":
                    continue

                value = alert.get("value")
                unit = alert.get("unit")

                # Skip weather notifications — not time-offset based
                if unit == "weather":
                    continue

                if not value or not unit:
                    continue

                # "Only if undone" check
                only_if_undone = alert.get("only_if_undone", True)
                if only_if_undone:
                    if chit.get("habit"):
                        goal = chit.get("habit_goal") or 1
                        success = chit.get("habit_success") or 0
                        if isinstance(goal, str):
                            try:
                                goal = int(goal)
                            except ValueError:
                                goal = 1
                        if isinstance(success, str):
                            try:
                                success = int(success)
                            except ValueError:
                                success = 0
                        if success >= goal:
                            continue
                    elif chit.get("status") == "Complete":
                        continue

                # Compute offset
                unit_seconds = {
                    "minutes": 60, "hours": 3600,
                    "days": 86400, "weeks": 604800
                }
                at_target = alert.get("atTarget", False)
                offset_secs = 0 if at_target else int(value) * unit_seconds.get(unit, 60)

                # Determine target datetime
                target_type = alert.get("targetType", "start")
                target_dt = None
                if target_type == "cycle" and chit.get("habit"):
                    target_dt = _get_habit_cycle_end(chit, datetime.utcnow())
                elif target_type == "due":
                    target_str = due_dt or start_dt
                    if target_str:
                        try:
                            target_dt = datetime.fromisoformat(target_str.replace("Z", "+00:00")).replace(tzinfo=None)
                        except (ValueError, TypeError):
                            pass
                elif target_type == "end":
                    target_str = end_dt or start_dt
                    if target_str:
                        try:
                            target_dt = datetime.fromisoformat(target_str.replace("Z", "+00:00")).replace(tzinfo=None)
                        except (ValueError, TypeError):
                            pass
                elif target_type == "point":
                    target_str = point_in_time_dt
                    if target_str:
                        try:
                            target_dt = datetime.fromisoformat(target_str.replace("Z", "+00:00")).replace(tzinfo=None)
                        except (ValueError, TypeError):
                            pass
                else:
                    target_str = start_dt or due_dt
                    if target_str:
                        try:
                            target_dt = datetime.fromisoformat(target_str.replace("Z", "+00:00")).replace(tzinfo=None)
                        except (ValueError, TypeError):
                            pass

                if not target_dt:
                    continue

                # Compute fire time
                after_target = alert.get("afterTarget", False)
                if at_target:
                    fire_dt = target_dt
                elif after_target:
                    fire_dt = target_dt + timedelta(seconds=offset_secs)
                else:
                    fire_dt = target_dt - timedelta(seconds=offset_secs)

                # Convert to UTC using the new timezone
                try:
                    fire_utc = compute_alert_utc(fire_dt, new_tz)
                except Exception:
                    continue

                # If fire time is now in the past, fire immediately
                if fire_utc <= now_utc:
                    if at_target:
                        body = f"at {target_type}"
                    else:
                        direction = "after" if after_target else "before"
                        body = f"{value} {unit} {direction} {target_type}"
                    _send_chit_push(user_id, chit_id, chit_title, "Reminder:", body)
                    try:
                        _send_chit_ntfy(user_id, chit_id, chit_title, "Reminder:", body)
                    except Exception as e:
                        logger.warning(f"Ntfy failed for recalc notif {chit_id}[{idx}]: {e}")
                    fired_count += 1

        logger.info(
            f"recalculate_floating_alerts: user '{user_id}', "
            f"checked {len(floating_chits)} floating chits, "
            f"fired {fired_count} past-due alerts (new tz: {new_tz})"
        )

    except Exception as e:
        logger.error(f"recalculate_floating_alerts error for user '{user_id}': {e}")


async def _alert_push_loop():
    """Background task: send push notifications for chit events, alarms, and notifications.

    Runs every 15 seconds. Checks for:
    1. Chits whose start_datetime or due_datetime falls in the current 60s window
    2. Chit alarms whose time matches the current HH:MM and day of week
    3. Chit notification alerts whose computed fire time falls in the current 60s window
    4. Independent alarms (standalone_alerts) whose time matches now

    Sends both Web Push and Ntfy notifications. Deduplicates using an in-memory
    set keyed by chit_id + alert_index + date so alarms don't re-fire.
    """
    # Dedup set: tracks fired alert keys for the current day
    _fired_keys = set()
    _fired_date = ""
    # Weather notification value tracking: only re-notify if value shifts by 5+
    # Key: "weather-{chit_id}-{idx}", Value: last notified display value (int)
    _weather_last_notified = {}

    while True:
        try:
            await asyncio.sleep(15)  # Check every 15 seconds for near-instant delivery
            now = datetime.utcnow()
            window_start = now - timedelta(seconds=15)
            now_iso = now.isoformat()
            window_start_iso = window_start.isoformat()
            current_hhmm = now.strftime("%H:%M")
            days_of_week = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
            current_day = days_of_week[now.weekday()]  # Python weekday: Mon=0..Sun=6
            today_str = now.strftime("%Y-%m-%d")

            # Reset dedup set at midnight
            if _fired_date != today_str:
                _fired_keys = set()
                _fired_date = today_str

            try:
                conn = sqlite3.connect(DB_PATH)
                cursor = conn.cursor()
                # Fetch all non-deleted chits with owner_id
                cursor.execute(
                    "SELECT id, title, start_datetime, end_datetime, due_datetime, "
                    "       point_in_time, owner_id, alerts, recurrence, "
                    "       status, habit, habit_goal, habit_success, timezone "
                    "FROM chits "
                    "WHERE (deleted = 0 OR deleted IS NULL) "
                    "AND owner_id IS NOT NULL AND owner_id != ''"
                )
                rows = cursor.fetchall()
                columns = [col[0] for col in cursor.description]
                chits = [dict(zip(columns, row)) for row in rows]

                # Also fetch independent alarms (standalone_alerts)
                cursor.execute(
                    "SELECT id, owner_id, data FROM standalone_alerts "
                    "WHERE owner_id IS NOT NULL AND owner_id != ''"
                )
                ia_rows = cursor.fetchall()
                ia_columns = [col[0] for col in cursor.description]
                independent_alerts = [dict(zip(ia_columns, row)) for row in ia_rows]

                conn.close()
            except Exception as e:
                logger.error(f"Alert push loop: DB query error: {e}")
                continue

            sent_count = 0

            for chit in chits:
                chit_id = chit.get("id")
                chit_title = chit.get("title") or "CWOC Reminder"
                owner_id = chit.get("owner_id")
                start_dt = chit.get("start_datetime")
                end_dt = chit.get("end_datetime")
                due_dt = chit.get("due_datetime")
                point_in_time_dt = chit.get("point_in_time")

                if not owner_id:
                    continue

                # ── 1. Start/due time notifications (timezone-aware) ───────

                # Convert stored start/due datetimes to UTC for comparison
                chit_tz = chit.get("timezone")
                _chit_tz_name = chit_tz.strip() if chit_tz and chit_tz.strip() else None

                if start_dt:
                    try:
                        start_naive = datetime.fromisoformat(start_dt.replace("Z", "").split("+")[0])
                        if _chit_tz_name:
                            start_utc = compute_alert_utc(start_naive, _chit_tz_name)
                        else:
                            _user_tz = get_user_current_timezone(owner_id)
                            start_utc = compute_alert_utc(start_naive, _user_tz)
                        start_utc_iso = start_utc.replace(tzinfo=None).isoformat()
                    except Exception:
                        start_utc_iso = start_dt
                    if window_start_iso < start_utc_iso <= now_iso:
                        key = f"start-{chit_id}-{today_str}"
                        if key not in _fired_keys:
                            _fired_keys.add(key)
                            try:
                                dt = datetime.fromisoformat(start_dt.replace("Z", "+00:00"))
                                time_str = dt.strftime("%I:%M %p").lstrip("0")
                            except (ValueError, TypeError):
                                time_str = start_dt
                            _send_chit_push(owner_id, chit_id, chit_title, "Starts at", time_str)
                            try:
                                _send_chit_ntfy(owner_id, chit_id, chit_title, "Starts at", time_str)
                            except Exception as e:
                                logger.warning(f"Ntfy failed for chit {chit_id} start: {e}")
                            sent_count += 1

                if due_dt:
                    try:
                        due_naive = datetime.fromisoformat(due_dt.replace("Z", "").split("+")[0])
                        if _chit_tz_name:
                            due_utc = compute_alert_utc(due_naive, _chit_tz_name)
                        else:
                            _user_tz = get_user_current_timezone(owner_id)
                            due_utc = compute_alert_utc(due_naive, _user_tz)
                        due_utc_iso = due_utc.replace(tzinfo=None).isoformat()
                    except Exception:
                        due_utc_iso = due_dt
                    if window_start_iso < due_utc_iso <= now_iso:
                        key = f"due-{chit_id}-{today_str}"
                        if key not in _fired_keys:
                            _fired_keys.add(key)
                            try:
                                dt = datetime.fromisoformat(due_dt.replace("Z", "+00:00"))
                                time_str = dt.strftime("%I:%M %p").lstrip("0")
                            except (ValueError, TypeError):
                                time_str = due_dt
                            _send_chit_push(owner_id, chit_id, chit_title, "Due at", time_str)
                            try:
                                _send_chit_ntfy(owner_id, chit_id, chit_title, "Due at", time_str)
                            except Exception as e:
                                logger.warning(f"Ntfy failed for chit {chit_id} due: {e}")
                            sent_count += 1

                # ── 2. Parse alerts JSON ────────────────────────────────────

                alerts_raw = chit.get("alerts")
                if not alerts_raw:
                    continue
                try:
                    alerts = json.loads(alerts_raw) if isinstance(alerts_raw, str) else alerts_raw
                except (json.JSONDecodeError, TypeError):
                    continue
                if not isinstance(alerts, list):
                    continue

                for idx, alert in enumerate(alerts):
                    alert_type = alert.get("_type")

                    # ── 3. Alarms — match current HH:MM + day ──────────────

                    if alert_type == "alarm":
                        if not alert.get("enabled") or not alert.get("time"):
                            continue
                        alarm_time = alert["time"]  # "HH:MM"
                        if alarm_time != current_hhmm:
                            continue
                        alarm_days = alert.get("days") or [current_day]
                        if current_day not in alarm_days:
                            continue
                        key = f"alarm-{chit_id}-{idx}-{today_str}"
                        if key in _fired_keys:
                            continue
                        _fired_keys.add(key)
                        alarm_name = alert.get("name", "")
                        label = f"🔔 Alarm at {alarm_time}"
                        if alarm_name:
                            label += f" — {alarm_name}"
                        _send_chit_push(owner_id, chit_id, chit_title, "Alarm at", alarm_time)
                        try:
                            _send_chit_ntfy(owner_id, chit_id, chit_title, "Alarm at", alarm_time)
                        except Exception as e:
                            logger.warning(f"Ntfy failed for alarm {chit_id}[{idx}]: {e}")
                        sent_count += 1

                    # ── 4. Notifications — compute fire time from offset ────

                    elif alert_type == "notification":
                        value = alert.get("value")
                        unit = alert.get("unit")

                        # ── Weather notifications — check forecast against threshold ──
                        if unit == "weather":
                            weather_condition = alert.get("weather_condition")
                            weather_threshold = alert.get("weather_threshold")
                            if not weather_condition:
                                continue

                            # Skip weather notifications for past chits — NEVER notify for past dates
                            # For recurring chits, check if TODAY is a valid occurrence
                            chit_end = end_dt or due_dt or start_dt or point_in_time_dt
                            if not chit_end:
                                continue
                            try:
                                if len(chit_end) <= 10:
                                    chit_end_dt = datetime.strptime(chit_end[:10], "%Y-%m-%d").replace(hour=23, minute=59, second=59)
                                else:
                                    chit_end_dt = datetime.fromisoformat(chit_end.replace("Z", "").split("+")[0])
                                # For recurring chits: the stored date may be in the past but today is valid
                                chit_recurrence = chit.get("recurrence")
                                has_recurrence = False
                                if chit_recurrence:
                                    try:
                                        rec = json.loads(chit_recurrence) if isinstance(chit_recurrence, str) else chit_recurrence
                                        if rec and rec.get("freq"):
                                            has_recurrence = True
                                    except (json.JSONDecodeError, TypeError, AttributeError):
                                        pass
                                if not has_recurrence and chit_end_dt < now - timedelta(hours=1):
                                    continue
                            except (ValueError, TypeError):
                                pass

                            key = f"weather-notif-{chit_id}-{idx}-{today_str}"
                            if key in _fired_keys:
                                continue
                            # Need weather_data for this chit — re-query it
                            try:
                                wconn = sqlite3.connect(DB_PATH)
                                wcur = wconn.cursor()
                                wcur.execute("SELECT weather_data FROM chits WHERE id = ?", (chit_id,))
                                wrow = wcur.fetchone()
                                wconn.close()
                                if not wrow or not wrow[0]:
                                    continue
                                wd = json.loads(wrow[0]) if isinstance(wrow[0], str) else wrow[0]
                            except Exception:
                                continue
                            if not wd:
                                continue

                            # For recurring chits, verify weather_data is for today
                            # (not stale data from the original instance date)
                            if has_recurrence and wd.get("focus_date"):
                                if wd["focus_date"] != today_str:
                                    # Stale weather data — skip notification until weather update refreshes it
                                    continue

                            # Determine user's unit system
                            try:
                                uconn = sqlite3.connect(DB_PATH)
                                ucur = uconn.cursor()
                                ucur.execute("SELECT unit_system FROM settings WHERE user_id = ?", (owner_id,))
                                urow = ucur.fetchone()
                                uconn.close()
                                user_metric = (urow[0] == "metric") if urow and urow[0] else False
                            except Exception:
                                user_metric = False

                            condition_met = False
                            body = ""

                            if weather_condition in ("high_above", "high_below", "low_above", "low_below"):
                                if wd.get("high") is None or wd.get("low") is None or weather_threshold is None:
                                    continue
                                high_c = wd["high"]
                                low_c = wd["low"]
                                # Threshold is stored in Celsius (canonical unit).
                                # Compare directly against Celsius forecast values.
                                threshold_c = weather_threshold
                                if weather_condition == "high_above" and high_c > threshold_c:
                                    condition_met = True
                                elif weather_condition == "high_below" and high_c < threshold_c:
                                    condition_met = True
                                elif weather_condition == "low_above" and low_c > threshold_c:
                                    condition_met = True
                                elif weather_condition == "low_below" and low_c < threshold_c:
                                    condition_met = True
                                # Format display values for notification text
                                if condition_met:
                                    if user_metric:
                                        high_display = round(high_c)
                                        low_display = round(low_c)
                                        thresh_display = round(threshold_c)
                                    else:
                                        high_display = round(high_c * 9 / 5 + 32)
                                        low_display = round(low_c * 9 / 5 + 32)
                                        thresh_display = round(threshold_c * 9 / 5 + 32)
                                    unit_label = "°C" if user_metric else "°F"
                                    if weather_condition == "high_above":
                                        body = f"high ({high_display}{unit_label}) above {thresh_display}{unit_label}"
                                    elif weather_condition == "high_below":
                                        body = f"high ({high_display}{unit_label}) below {thresh_display}{unit_label}"
                                    elif weather_condition == "low_above":
                                        body = f"low ({low_display}{unit_label}) above {thresh_display}{unit_label}"
                                    elif weather_condition == "low_below":
                                        body = f"low ({low_display}{unit_label}) below {thresh_display}{unit_label}"

                            elif weather_condition == "rain":
                                wcode = wd.get("weather_code")
                                precip_mode = alert.get("weather_precip_mode", "any")
                                if precip_mode == "more_than":
                                    precip_mm = wd.get("precipitation")
                                    if precip_mm is None or weather_threshold is None:
                                        continue
                                    rain_codes = (61, 63, 65, 66, 67, 80, 81, 82, 51, 53, 55, 56, 57)
                                    is_rain = wcode is not None and wcode in rain_codes
                                    # Threshold is stored in mm (canonical unit).
                                    # Compare directly against mm forecast values.
                                    if is_rain and precip_mm > weather_threshold:
                                        condition_met = True
                                        if user_metric:
                                            precip_display = round(precip_mm, 1)
                                            thresh_display = round(weather_threshold, 1)
                                            p_unit = "mm"
                                        else:
                                            precip_display = round(precip_mm / 25.4, 1)
                                            thresh_display = round(weather_threshold / 25.4, 1)
                                            p_unit = "in"
                                        body = f"rain ({precip_display} {p_unit}) over {thresh_display} {p_unit}"
                                else:
                                    if wcode is None:
                                        continue
                                    if wcode in (61, 63, 65, 66, 67, 80, 81, 82, 51, 53, 55, 56, 57):
                                        condition_met = True
                                        body = "rain in forecast"

                            elif weather_condition == "snow":
                                wcode = wd.get("weather_code")
                                precip_mode = alert.get("weather_precip_mode", "any")
                                if precip_mode == "more_than":
                                    precip_mm = wd.get("precipitation")
                                    if precip_mm is None or weather_threshold is None:
                                        continue
                                    snow_codes = (71, 73, 75, 77, 85, 86)
                                    is_snow = wcode is not None and wcode in snow_codes
                                    # Threshold is stored in mm (canonical unit).
                                    if is_snow and precip_mm > weather_threshold:
                                        condition_met = True
                                        if user_metric:
                                            precip_display = round(precip_mm, 1)
                                            thresh_display = round(weather_threshold, 1)
                                            p_unit = "mm"
                                        else:
                                            precip_display = round(precip_mm / 25.4, 1)
                                            thresh_display = round(weather_threshold / 25.4, 1)
                                            p_unit = "in"
                                        body = f"snow ({precip_display} {p_unit}) over {thresh_display} {p_unit}"
                                else:
                                    if wcode is None:
                                        continue
                                    if wcode in (71, 73, 75, 77, 85, 86):
                                        condition_met = True
                                        body = "snow in forecast"

                            elif weather_condition == "hail":
                                wcode = wd.get("weather_code")
                                precip_mode = alert.get("weather_precip_mode", "any")
                                if precip_mode == "more_than":
                                    precip_mm = wd.get("precipitation")
                                    if precip_mm is None or weather_threshold is None:
                                        continue
                                    hail_codes = (96, 99)
                                    is_hail = wcode is not None and wcode in hail_codes
                                    # Threshold is stored in mm (canonical unit).
                                    if is_hail and precip_mm > weather_threshold:
                                        condition_met = True
                                        if user_metric:
                                            precip_display = round(precip_mm, 1)
                                            thresh_display = round(weather_threshold, 1)
                                            p_unit = "mm"
                                        else:
                                            precip_display = round(precip_mm / 25.4, 1)
                                            thresh_display = round(weather_threshold / 25.4, 1)
                                            p_unit = "in"
                                        body = f"hail ({precip_display} {p_unit}) over {thresh_display} {p_unit}"
                                else:
                                    if wcode is None:
                                        continue
                                    if wcode in (96, 99):
                                        condition_met = True
                                        body = "hail in forecast"

                            elif weather_condition == "precipitation":
                                wcode = wd.get("weather_code")
                                precip_mode = alert.get("weather_precip_mode", "any")
                                if precip_mode == "more_than":
                                    precip_mm = wd.get("precipitation")
                                    if precip_mm is None or weather_threshold is None:
                                        continue
                                    # Threshold is stored in mm (canonical unit).
                                    if precip_mm > weather_threshold:
                                        condition_met = True
                                        if user_metric:
                                            precip_display = round(precip_mm, 1)
                                            thresh_display = round(weather_threshold, 1)
                                            p_unit = "mm"
                                        else:
                                            precip_display = round(precip_mm / 25.4, 1)
                                            thresh_display = round(weather_threshold / 25.4, 1)
                                            p_unit = "in"
                                        body = f"precipitation ({precip_display} {p_unit}) over {thresh_display} {p_unit}"
                                else:
                                    if wcode is None:
                                        continue
                                    all_precip_codes = (51,53,55,56,57,61,63,65,66,67,71,73,75,77,80,81,82,85,86,95,96,99)
                                    if wcode in all_precip_codes:
                                        condition_met = True
                                        body = "precipitation in forecast"

                            elif weather_condition == "wind_above":
                                wind_gusts = wd.get("wind_gusts")
                                wind_speed = wd.get("wind_speed")
                                # Use the higher of sustained wind and gusts
                                wind_max = None
                                if wind_gusts is not None and wind_speed is not None:
                                    wind_max = max(wind_gusts, wind_speed)
                                elif wind_gusts is not None:
                                    wind_max = wind_gusts
                                elif wind_speed is not None:
                                    wind_max = wind_speed
                                if wind_max is None or weather_threshold is None:
                                    continue
                                # Threshold is stored in km/h (canonical unit).
                                # Compare directly against km/h forecast values.
                                if wind_max > weather_threshold:
                                    condition_met = True
                                    # Format display values for notification text
                                    if user_metric:
                                        wind_display = round(wind_max)
                                        thresh_display = round(weather_threshold)
                                        wind_unit = "km/h"
                                    else:
                                        wind_display = round(wind_max * 0.621371)
                                        thresh_display = round(weather_threshold * 0.621371)
                                        wind_unit = "mph"
                                    body = f"wind ({wind_display} {wind_unit}) over {thresh_display} {wind_unit}"

                            if not condition_met:
                                continue

                            # ── 5-unit shift threshold for numeric conditions ──
                            # For temp/wind/precip-more-than: only re-notify if value shifted by 5+ from last notification
                            # Uses canonical units (°C, km/h, mm) for consistent tracking
                            weather_track_key = f"weather-{chit_id}-{idx}"
                            precip_mode_check = alert.get("weather_precip_mode", "any")
                            if weather_condition in ("high_above", "high_below", "low_above", "low_below", "wind_above"):
                                # Determine the current relevant value in canonical units
                                if weather_condition.startswith("high"):
                                    current_val = high_c
                                elif weather_condition.startswith("low"):
                                    current_val = low_c
                                else:
                                    current_val = wind_max
                                # Check if we've notified before and if shift is < 3 (in canonical units)
                                if weather_track_key in _weather_last_notified:
                                    last_val = _weather_last_notified[weather_track_key]
                                    if abs(current_val - last_val) < 3:
                                        _fired_keys.add(key)
                                        continue
                                _weather_last_notified[weather_track_key] = current_val
                            elif weather_condition in ("precipitation", "rain", "snow", "hail") and precip_mode_check == "more_than":
                                # For precip "more than" mode, use shift on the mm value
                                precip_mm = wd.get("precipitation", 0)
                                if weather_track_key in _weather_last_notified:
                                    last_val = _weather_last_notified[weather_track_key]
                                    if abs(precip_mm - last_val) < 3:
                                        _fired_keys.add(key)
                                        continue
                                _weather_last_notified[weather_track_key] = precip_mm
                            else:
                                # Rain/snow/hail/precip "any" mode: just use daily dedup
                                pass

                            _fired_keys.add(key)
                            _send_chit_push(owner_id, chit_id, chit_title, "Weather Alert:", body)
                            try:
                                _send_chit_ntfy(owner_id, chit_id, chit_title, "Weather Alert:", body)
                            except Exception as e:
                                logger.warning(f"Ntfy failed for weather notif {chit_id}[{idx}]: {e}")
                            sent_count += 1
                            continue

                        if not value or not unit:
                            continue

                        # "Only if undone" check
                        only_if_undone = alert.get("only_if_undone", True)
                        if only_if_undone:
                            if chit.get("habit"):
                                goal = chit.get("habit_goal") or 1
                                success = chit.get("habit_success") or 0
                                if isinstance(goal, str):
                                    try: goal = int(goal)
                                    except: goal = 1
                                if isinstance(success, str):
                                    try: success = int(success)
                                    except: success = 0
                                if success >= goal:
                                    continue
                            elif chit.get("status") == "Complete":
                                continue

                        # Compute offset — "at" mode uses 0
                        unit_seconds = {
                            "minutes": 60, "hours": 3600,
                            "days": 86400, "weeks": 604800
                        }
                        at_target = alert.get("atTarget", False)
                        offset_secs = 0 if at_target else int(value) * unit_seconds.get(unit, 60)

                        # Determine target datetime
                        target_type = alert.get("targetType", "start")
                        if target_type == "cycle" and chit.get("habit"):
                            # Habit cycle end — compute end of current period
                            target_dt = _get_habit_cycle_end(chit, now)
                            if not target_dt:
                                continue
                        elif target_type == "due":
                            target_str = due_dt or start_dt
                            if not target_str:
                                continue
                            try:
                                target_dt = datetime.fromisoformat(target_str.replace("Z", "+00:00")).replace(tzinfo=None)
                            except (ValueError, TypeError):
                                continue
                        elif target_type == "end":
                            target_str = end_dt or start_dt
                            if not target_str:
                                continue
                            try:
                                target_dt = datetime.fromisoformat(target_str.replace("Z", "+00:00")).replace(tzinfo=None)
                            except (ValueError, TypeError):
                                continue
                        elif target_type == "point":
                            target_str = point_in_time_dt
                            if not target_str:
                                continue
                            try:
                                target_dt = datetime.fromisoformat(target_str.replace("Z", "+00:00")).replace(tzinfo=None)
                            except (ValueError, TypeError):
                                continue
                        else:
                            target_str = start_dt or due_dt
                            if not target_str:
                                continue
                            try:
                                target_dt = datetime.fromisoformat(target_str.replace("Z", "+00:00")).replace(tzinfo=None)
                            except (ValueError, TypeError):
                                continue

                        # at = exactly at target, before = target - offset, after = target + offset
                        after_target = alert.get("afterTarget", False)
                        if at_target:
                            fire_dt = target_dt
                        elif after_target:
                            fire_dt = target_dt + timedelta(seconds=offset_secs)
                        else:
                            fire_dt = target_dt - timedelta(seconds=offset_secs)

                        # ── Timezone-aware fire time computation ────────────────
                        # Convert the naive wall-clock fire_dt to UTC using the
                        # appropriate timezone:
                        #   - Anchored chits (timezone set): use chit's stored timezone
                        #   - Floating chits (timezone null): use user's current timezone
                        chit_tz = chit.get("timezone")
                        if chit_tz and chit_tz.strip():
                            # Anchored: fire time locked to chit's timezone
                            try:
                                fire_utc = compute_alert_utc(fire_dt, chit_tz.strip())
                                fire_iso = fire_utc.replace(tzinfo=None).isoformat()
                            except Exception:
                                # Invalid timezone — fall back to treating as naive UTC
                                fire_iso = fire_dt.isoformat()
                        else:
                            # Floating: fire time in user's current timezone
                            user_tz = get_user_current_timezone(owner_id)
                            try:
                                fire_utc = compute_alert_utc(fire_dt, user_tz)
                                fire_iso = fire_utc.replace(tzinfo=None).isoformat()
                            except Exception:
                                # Fallback to treating as naive UTC
                                fire_iso = fire_dt.isoformat()

                        if window_start_iso < fire_iso <= now_iso:
                            key = f"notif-{chit_id}-{idx}-{fire_iso[:16]}"
                            if key in _fired_keys:
                                continue
                            _fired_keys.add(key)
                            if target_type == "cycle":
                                body = f"will be missed within {value} {unit}"
                            elif at_target:
                                body = f"at {target_type}"
                            else:
                                direction = "after" if after_target else "before"
                                body = f"{value} {unit} {direction} {target_type}"
                            _send_chit_push(owner_id, chit_id, chit_title, "Reminder:", body)
                            try:
                                _send_chit_ntfy(owner_id, chit_id, chit_title, "Reminder:", body)
                            except Exception as e:
                                logger.warning(f"Ntfy failed for notification {chit_id}[{idx}]: {e}")
                            sent_count += 1

            # ── 5. Independent alarms (standalone_alerts) ───────────────────

            for ia in independent_alerts:
                ia_id = ia.get("id")
                owner_id = ia.get("owner_id")
                data_raw = ia.get("data")
                if not owner_id or not data_raw:
                    continue
                try:
                    data = json.loads(data_raw) if isinstance(data_raw, str) else data_raw
                except (json.JSONDecodeError, TypeError):
                    continue

                if data.get("_type") != "alarm":
                    continue
                if not data.get("enabled") or not data.get("time"):
                    continue
                if data["time"] != current_hhmm:
                    continue
                alarm_days = data.get("days") or [current_day]
                if current_day not in alarm_days:
                    continue
                key = f"ia-alarm-{ia_id}-{today_str}"
                if key in _fired_keys:
                    continue
                _fired_keys.add(key)
                name = data.get("name") or "Independent Alarm"
                ia_base = _get_server_base_url()
                ia_click_url = f"{ia_base}/?tab=Alarms&view=independent"
                ia_icon_url = f"{ia_base}/static/cwoc-icon-192.png"
                try:
                    from src.backend.routes.ntfy import send_ntfy_notification, build_ntfy_actions, get_user_snooze_minutes
                    ia_snooze = get_user_snooze_minutes(owner_id)
                    ia_actions = build_ntfy_actions(ia_base, source_type="independent",
                                                    snooze_minutes=ia_snooze)
                    send_ntfy_notification(
                        user_id=owner_id,
                        title=name,
                        body=f"Alarm at {data['time']}",
                        click_url=ia_click_url,
                        tags="alarm_clock",
                        priority=5,
                        icon_url=ia_icon_url,
                        actions=ia_actions,
                    )
                except Exception as e:
                    logger.warning(f"Ntfy failed for independent alarm {ia_id}: {e}")
                sent_count += 1

            if sent_count > 0:
                logger.info(f"Alert push loop: sent {sent_count} notification(s)")

        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.error(f"Alert push loop unexpected error: {e}")


async def _snooze_check_loop():
    """Background task: unsnooze chits whose snoozed_until has passed.

    Runs every 60 seconds. Clears snoozed_until for expired snoozes,
    effectively making the chit visible in views again.
    """
    while True:
        try:
            await asyncio.sleep(60)
            now = datetime.utcnow().isoformat()
            conn = sqlite3.connect(DB_PATH)
            cursor = conn.cursor()
            cursor.execute(
                "SELECT id, owner_id, title FROM chits WHERE snoozed_until IS NOT NULL AND snoozed_until <= ?",
                (now,),
            )
            rows = cursor.fetchall()
            if rows:
                for row in rows:
                    chit_id, owner_id, title = row
                    cursor.execute("UPDATE chits SET snoozed_until = NULL WHERE id = ?", (chit_id,))
                    logger.info(f"Unsnoozed chit {chit_id} ('{title}') for user {owner_id}")
                    # Send push notification that snooze ended
                    try:
                        _send_chit_push(owner_id, chit_id, title or "Untitled", "Snooze ended", "now visible again")
                    except Exception:
                        pass
                conn.commit()
            conn.close()
        except Exception as e:
            logger.error(f"Snooze check loop error: {e}")
            await asyncio.sleep(60)


# ── Email Send Later: background scheduler ───────────────────────────────

async def _email_send_later_loop():
    """Background task: send scheduled emails whose email_send_at time has passed.

    Runs every 5 seconds. Checks for draft email chits where email_send_at <= now
    and sends them via the email route's send logic.
    """
    # Wait for server to fully start
    await asyncio.sleep(5)

    while True:
        try:
            await asyncio.sleep(5)  # Check every 5 seconds for responsive undo-send
            now = datetime.utcnow()
            now_iso = now.isoformat() + "Z"

            try:
                conn = sqlite3.connect(DB_PATH)
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()

                # Find all draft emails with a send_at time that has passed
                cursor.execute(
                    "SELECT id, owner_id, email_send_at FROM chits "
                    "WHERE email_status = 'draft' "
                    "AND email_send_at IS NOT NULL AND email_send_at != '' "
                    "AND email_send_at <= ? "
                    "AND (deleted = 0 OR deleted IS NULL)",
                    (now_iso,)
                )
                rows = cursor.fetchall()
                conn.close()

                if not rows:
                    continue

                for row in rows:
                    chit_id = row["id"]
                    owner_id = row["owner_id"]
                    try:
                        # Import and call the send logic from email routes
                        from src.backend.routes.email import _do_send_email_by_id
                        result = _do_send_email_by_id(chit_id, owner_id)
                        if result.get("status") == "sent":
                            logger.info(f"[SendLater] Sent scheduled email {chit_id} for user {owner_id}")
                        else:
                            logger.warning(f"[SendLater] Send returned non-sent status for {chit_id}: {result}")
                    except Exception as e:
                        logger.error(f"[SendLater] Failed to send scheduled email {chit_id}: {e}")
                        # Clear the send_at so it doesn't retry forever on permanent errors
                        try:
                            err_conn = sqlite3.connect(DB_PATH)
                            err_cursor = err_conn.cursor()
                            err_cursor.execute(
                                "UPDATE chits SET email_send_at = NULL WHERE id = ?",
                                (chit_id,)
                            )
                            err_conn.commit()
                            err_conn.close()
                        except Exception:
                            pass

            except Exception as e:
                logger.error(f"[SendLater] DB query error: {e}")

        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.error(f"[SendLater] Unexpected error: {e}")


# ── Timezone Change Detection & Floating Alert Recalculation ─────────────

# Cache of last-known timezone per user: {user_id: tz_name}
_user_tz_cache = {}


async def _timezone_change_detection_loop():
    """Background task: detect timezone changes and recalculate floating chit alerts.

    Runs every 30 seconds. For each user with settings, resolves their current
    timezone and compares to a cached value. If different:
    - Recalculates all pending floating chit alerts (timezone IS NULL) using the new timezone
    - Does NOT recalculate anchored chit alerts (timezone IS NOT NULL)
    - If a recalculated fire time falls in the past, fires the alert immediately

    This loop provides a safety net in addition to the settings-save-triggered
    recalculation. It ensures timezone changes are detected within 60 seconds
    regardless of how the change occurred.

    Requirement 6.3: Recalculate within 60 seconds of change detection.
    Requirement 6.4: Do NOT recalculate anchored chit alerts.
    Requirement 6.5: Fire immediately if recalculated time is in the past.
    """
    global _user_tz_cache

    # Wait for server to fully start
    await asyncio.sleep(5)

    while True:
        try:
            await asyncio.sleep(30)  # Check every 30 seconds (well within 60s requirement)

            try:
                conn = sqlite3.connect(DB_PATH)
                cursor = conn.cursor()
                # Get all users with settings
                cursor.execute("SELECT user_id, timezone_override, default_timezone FROM settings")
                user_rows = cursor.fetchall()
                conn.close()
            except Exception as e:
                logger.error(f"[TZ-Detection] DB query error: {e}")
                continue

            for row in user_rows:
                user_id = row[0]
                override = row[1]
                default_tz = row[2]

                # Resolve current timezone (same logic as get_user_current_timezone)
                if override and override.strip():
                    current_tz = override.strip()
                elif default_tz and default_tz.strip():
                    current_tz = default_tz.strip()
                else:
                    current_tz = "UTC"

                # Compare to cached value
                last_tz = _user_tz_cache.get(user_id)
                _user_tz_cache[user_id] = current_tz

                if last_tz is None:
                    # First time seeing this user — just cache, no recalculation
                    continue

                if last_tz == current_tz:
                    # No change
                    continue

                # Timezone changed! Recalculate floating chit alerts.
                logger.info(
                    f"[TZ-Detection] Timezone change detected for user '{user_id}': "
                    f"'{last_tz}' → '{current_tz}'. Recalculating floating alerts."
                )

                # Use the existing recalculate_floating_alerts function which handles:
                # - Only floating chits (timezone IS NULL) — NOT anchored
                # - Fires immediately if recalculated time is in the past
                try:
                    recalculate_floating_alerts(user_id)
                except Exception as e:
                    logger.error(f"[TZ-Detection] Recalculation failed for user '{user_id}': {e}")

        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.error(f"[TZ-Detection] Unexpected error: {e}")


async def start_weather_schedulers():
    """Register background weather tasks. Called from main.py on startup."""
    from src.backend.routes.audit import _run_auto_prune

    # Auto-prune audit log in background (never blocks server startup)
    async def _deferred_auto_prune():
        await asyncio.sleep(10)  # Let server fully start first
        try:
            _run_auto_prune()
        except Exception as e:
            logger.error(f"Deferred auto-prune failed: {str(e)}")
    asyncio.create_task(_deferred_auto_prune())
    asyncio.create_task(_weather_hourly_loop())
    asyncio.create_task(_weather_daily_loop())
    asyncio.create_task(_alert_push_loop())
    asyncio.create_task(_snooze_check_loop())
    asyncio.create_task(_email_send_later_loop())
    asyncio.create_task(_timezone_change_detection_loop())
    logger.info("Weather scheduler tasks started (hourly + daily + alert push + snooze check + email send-later + timezone detection)")


# ══════════════════════════════════════════════════════════════════════════
# Rules Engine — Scheduled Rule Execution
# ══════════════════════════════════════════════════════════════════════════

from src.backend.db import deserialize_json_field


def _derive_period_from_cron(cron_expr: str) -> str:
    """Derive the habit period from a cron expression.

    Returns 'daily', 'weekly', or 'monthly' based on the cron pattern:
    - If day-of-month is specific (not *) → monthly
    - If day-of-week is specific (not *) and day-of-month is * → weekly
    - Otherwise → daily (including sub-daily crons)
    """
    parsed = parse_cron(cron_expr)
    if parsed is None:
        return "daily"

    all_dom = parsed["days_of_month"] == set(range(1, 32))
    all_dow = parsed["days_of_week"] == set(range(0, 7))

    if not all_dom:
        # Specific day(s) of month → monthly period
        return "monthly"
    elif not all_dow:
        # Specific day(s) of week → weekly period
        return "weekly"
    else:
        # All days match → daily period
        return "daily"


def _get_previous_period_date(period: str, now: datetime) -> str:
    """Get the date string (YYYY-MM-DD) for the previous period relative to now.

    - daily: yesterday
    - weekly: the start of last week (Monday of last week)
    - monthly: the 1st of last month
    """
    if period == "daily":
        prev = now - timedelta(days=1)
        return prev.strftime("%Y-%m-%d")
    elif period == "weekly":
        # Go back to the start of the current week (Monday), then back 7 days
        days_since_monday = now.weekday()  # Mon=0, Sun=6
        this_monday = now - timedelta(days=days_since_monday)
        last_monday = this_monday - timedelta(days=7)
        return last_monday.strftime("%Y-%m-%d")
    elif period == "monthly":
        # 1st of last month
        if now.month == 1:
            prev_month_start = datetime(now.year - 1, 12, 1)
        else:
            prev_month_start = datetime(now.year, now.month - 1, 1)
        return prev_month_start.strftime("%Y-%m-%d")
    return (now - timedelta(days=1)).strftime("%Y-%m-%d")


def _check_and_insert_missed_habit_entries(rule: dict, now: datetime, cursor) -> bool:
    """Check if a habit_mode rule missed a previous period and insert a 'missed' entry.

    Looks at the previous period (based on cron-derived period) and checks if
    habit_history already has an entry for that date. If not, inserts a missed entry.

    Returns True if a missed entry was inserted, False otherwise.
    """
    if not rule.get("habit_mode"):
        return False

    # Get the cron expression
    config_raw = rule.get("schedule_config")
    if not config_raw:
        return False
    if isinstance(config_raw, str):
        try:
            config = json.loads(config_raw)
        except (json.JSONDecodeError, TypeError):
            return False
    else:
        config = config_raw

    cron_expr = config.get("cron") if isinstance(config, dict) else None
    if not cron_expr:
        return False

    # Derive period and get previous period date
    period = _derive_period_from_cron(cron_expr)
    prev_date = _get_previous_period_date(period, now)

    # Load existing habit_history
    history_raw = rule.get("habit_history")
    if isinstance(history_raw, str) and history_raw.strip():
        try:
            habit_history = json.loads(history_raw)
        except (json.JSONDecodeError, TypeError):
            habit_history = []
    else:
        habit_history = []
    if not isinstance(habit_history, list):
        habit_history = []

    # Check if an entry already exists for the previous period date
    existing_dates = {entry.get("date") for entry in habit_history if isinstance(entry, dict)}
    if prev_date in existing_dates:
        return False

    # Also skip if the rule was created after the previous period
    # (don't mark periods before the rule existed as missed)
    created_raw = rule.get("created_datetime")
    if created_raw and isinstance(created_raw, str) and created_raw.strip():
        try:
            created_dt = datetime.fromisoformat(created_raw.replace("Z", "+00:00")).replace(tzinfo=None)
            prev_date_dt = datetime.strptime(prev_date, "%Y-%m-%d")
            if created_dt > prev_date_dt + timedelta(days=1):
                # Rule didn't exist during the previous period
                return False
        except (ValueError, TypeError):
            pass

    # Insert missed entry
    missed_entry = {
        "date": prev_date,
        "status": "missed",
        "entities_matched": 0,
        "actions_applied": 0,
        "executed_datetime": None,
    }
    habit_history.append(missed_entry)

    # Trim to last 365 entries
    if len(habit_history) > 365:
        habit_history = habit_history[-365:]

    # Write updated habit_history back to the rules table
    rule_id = rule.get("id", "")
    try:
        cursor.execute(
            "UPDATE rules SET habit_history = ? WHERE id = ?",
            (json.dumps(habit_history), rule_id),
        )
        logger.info(
            "Missed habit entry inserted for rule '%s' (period: %s, date: %s)",
            rule.get("name", ""), period, prev_date,
        )
        # Update the in-memory rule so subsequent logic sees the new history
        rule["habit_history"] = json.dumps(habit_history)

        # Fire habit_missed trigger for other rules to react
        _fire_habit_trigger(
            "habit_missed", rule_id, rule.get("name", ""),
            rule.get("owner_id", ""), habit_history, datetime.utcnow(),
        )

        return True
    except Exception as e:
        logger.error(
            "Failed to insert missed habit entry for rule %s: %s", rule_id, e
        )
        return False


def _is_scheduled_rule_due(rule: dict, now: datetime) -> bool:
    """Check whether a scheduled rule is due for execution based on its
    schedule_config and last_run_datetime.

    schedule_config JSON shape:
        {"cron": "0 6 * * *"}  (takes precedence if present)
        OR
        {"frequency": "daily"|"hourly", "interval": int, "time_of_day": "HH:MM"}

    Returns True when the cron expression matches the current minute (and hasn't
    already run this minute), or when enough time has elapsed since the last run
    for frequency-based configs.
    """
    config_raw = rule.get("schedule_config")
    if not config_raw:
        return False

    if isinstance(config_raw, str):
        try:
            config = json.loads(config_raw)
        except (json.JSONDecodeError, TypeError):
            return False
    else:
        config = config_raw

    if not isinstance(config, dict):
        return False

    # ── Cron-based scheduling (takes precedence) ────────────────────────
    cron_expr = config.get("cron")
    if cron_expr:
        parsed = parse_cron(cron_expr)
        if parsed is None:
            logger.warning("Rule %s has invalid cron expression: %r — skipping",
                           rule.get("id", "?"), cron_expr)
            return False

        if not matches(parsed, now):
            return False

        # Verify rule hasn't already run in this minute
        last_run_raw = rule.get("last_run_datetime")
        if last_run_raw and isinstance(last_run_raw, str) and last_run_raw.strip():
            try:
                last_run = datetime.fromisoformat(
                    last_run_raw.replace("Z", "+00:00")
                ).replace(tzinfo=None)
                # Same year, month, day, hour, and minute = already ran this minute
                if (last_run.year == now.year and last_run.month == now.month
                        and last_run.day == now.day and last_run.hour == now.hour
                        and last_run.minute == now.minute):
                    return False
            except (ValueError, TypeError):
                pass  # Can't parse last_run — allow execution

        return True

    # ── Frequency/interval-based scheduling (backward compatibility) ────

    frequency = config.get("frequency", "daily")
    interval = int(config.get("interval", 1) or 1)
    time_of_day = config.get("time_of_day")  # "HH:MM" or None

    last_run_raw = rule.get("last_run_datetime")
    last_run = None
    if last_run_raw and isinstance(last_run_raw, str) and last_run_raw.strip():
        try:
            last_run = datetime.fromisoformat(last_run_raw.replace("Z", "+00:00")).replace(tzinfo=None)
        except (ValueError, TypeError):
            last_run = None

    if frequency == "daily":
        # Daily rules: check if the current time matches time_of_day (HH:MM)
        # and that we haven't already run today.
        if time_of_day:
            current_hhmm = now.strftime("%H:%M")
            if current_hhmm != time_of_day:
                # Not the right time yet — but check if we're within the
                # 60-second polling window (scheduler runs every 60s).
                try:
                    target_h, target_m = int(time_of_day.split(":")[0]), int(time_of_day.split(":")[1])
                    target_today = now.replace(hour=target_h, minute=target_m, second=0, microsecond=0)
                    diff = abs((now - target_today).total_seconds())
                    if diff > 90:  # outside the polling window
                        return False
                except (ValueError, IndexError):
                    return False

        # Check interval (every N days)
        if last_run:
            elapsed = (now - last_run).total_seconds()
            required = interval * 86400  # days in seconds
            if elapsed < required - 90:  # 90s grace for scheduler jitter
                return False

        return True

    elif frequency == "hourly":
        # Hourly rules: check if enough hours have elapsed since last run.
        if last_run:
            elapsed = (now - last_run).total_seconds()
            required = interval * 3600  # hours in seconds
            if elapsed < required - 90:  # 90s grace for scheduler jitter
                return False
        return True

    # Unknown frequency — don't run
    return False


async def _rules_scheduled_loop():
    """Background task: check for due scheduled rules every 60 seconds.

    For each due rule:
    1. Query all matching entities (chits for chit-scoped, contacts for contact-scoped)
    2. Evaluate the condition tree against each entity
    3. Execute or queue actions based on confirm_before_apply
    4. Update rule metadata (last_run_datetime, run_count, last_run_result)
    5. Insert execution log entry
    """
    from src.backend.rules_engine import (
        evaluate_condition_tree,
        execute_action,
        _build_action_description,
    )
    from uuid import uuid4

    # On first iteration, run immediately to catch overdue rules after restart
    first_run = True

    while True:
        try:
            if first_run:
                # Short delay to let the server fully start
                await asyncio.sleep(5)
                first_run = False
            else:
                await asyncio.sleep(60)

            now = datetime.utcnow()
            current_time = now.isoformat()

            conn = None
            try:
                conn = sqlite3.connect(DB_PATH)
                cursor = conn.cursor()

                # ── 1. Load all enabled scheduled rules ──────────
                cursor.execute(
                    "SELECT * FROM rules WHERE trigger_type = 'scheduled' AND enabled = 1 "
                    "ORDER BY priority ASC"
                )
                columns = [col[0] for col in cursor.description]
                rules = [dict(zip(columns, row)) for row in cursor.fetchall()]

                if not rules:
                    continue

                for rule in rules:
                    rule_id = rule.get("id", "")
                    rule_name = rule.get("name", "")
                    owner_id = rule.get("owner_id", "")
                    confirm = rule.get("confirm_before_apply", 1)

                    if not owner_id:
                        continue

                    # ── 1.5. Check for missed habit periods ──────
                    # For habit_mode rules, detect if the previous period was
                    # missed (server was down, etc.) and insert a missed entry.
                    if rule.get("habit_mode"):
                        try:
                            _check_and_insert_missed_habit_entries(rule, now, cursor)
                        except Exception as missed_err:
                            logger.error(
                                "Missed habit check failed for rule %s: %s",
                                rule_id, missed_err,
                            )

                    # ── 2. Check if rule is due ──────────────────
                    if not _is_scheduled_rule_due(rule, now):
                        continue

                    logger.info("Scheduled rule '%s' (%s) is due — executing", rule_name, rule_id)

                    # ── 3. Parse conditions and actions ──────────
                    conditions_raw = rule.get("conditions")
                    if isinstance(conditions_raw, str):
                        conditions = deserialize_json_field(conditions_raw)
                    else:
                        conditions = conditions_raw

                    actions_raw = rule.get("actions")
                    if isinstance(actions_raw, str):
                        actions_list = deserialize_json_field(actions_raw)
                    else:
                        actions_list = actions_raw
                    actions_list = actions_list or []

                    # ── 4. Determine entity scope and load entities
                    # Scheduled rules evaluate against all entities of the
                    # appropriate type for the owner.
                    # Heuristic: if conditions reference contact fields, scope
                    # to contacts; otherwise default to chits.
                    cond_str = json.dumps(conditions or {}).lower()
                    act_str = json.dumps(actions_list or []).lower()
                    contact_fields = {"given_name", "surname", "organization", "display_name"}
                    is_contact_scoped = any(f in cond_str for f in contact_fields)

                    entities = []
                    entity_type = "contact" if is_contact_scoped else "chit"

                    if entity_type == "chit":
                        cursor.execute(
                            "SELECT * FROM chits WHERE owner_id = ? AND (deleted = 0 OR deleted IS NULL)",
                            (owner_id,),
                        )
                    else:
                        cursor.execute(
                            "SELECT * FROM contacts WHERE owner_id = ?",
                            (owner_id,),
                        )

                    ent_columns = [col[0] for col in cursor.description]
                    entities = [dict(zip(ent_columns, row)) for row in cursor.fetchall()]

                    # ── 5. Pre-load contacts for cross-ref if needed
                    contacts = None
                    if "contact" in cond_str or "add_matching_contacts" in act_str:
                        cursor.execute(
                            "SELECT * FROM contacts WHERE owner_id = ?", (owner_id,)
                        )
                        contact_cols = [col[0] for col in cursor.description]
                        contacts = [dict(zip(contact_cols, r)) for r in cursor.fetchall()]

                    # ── 6. Evaluate and execute ──────────────────
                    entities_evaluated = len(entities)
                    entities_matched = 0
                    total_actions_executed = 0
                    total_actions_failed = 0

                    for entity in entities:
                        matched = False
                        try:
                            if conditions and isinstance(conditions, dict):
                                matched = evaluate_condition_tree(conditions, entity, contacts)
                            elif not conditions:
                                # No conditions = match all entities
                                matched = True
                        except Exception as eval_err:
                            logger.error(
                                "Scheduled rule %s condition eval failed on entity %s: %s",
                                rule_id, entity.get("id", "?"), eval_err,
                            )
                            continue

                        if not matched:
                            continue

                        entities_matched += 1

                        if confirm:
                            # Queue each action for confirmation
                            for act in actions_list:
                                try:
                                    act_type = act.get("type", "unknown")
                                    act_params = act.get("params", {})
                                    description = _build_action_description(act_type, act_params, entity)
                                    confirmation_id = str(uuid4())
                                    cursor.execute(
                                        "INSERT INTO rule_confirmations "
                                        "(id, rule_id, rule_name, owner_id, action_description, "
                                        " action_data, target_entity_type, target_entity_id, created_datetime) "
                                        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                                        (
                                            confirmation_id,
                                            rule_id,
                                            rule_name,
                                            owner_id,
                                            description,
                                            serialize_json_field(act),
                                            entity_type,
                                            entity.get("id", ""),
                                            current_time,
                                        ),
                                    )
                                    total_actions_executed += 1
                                except Exception as q_err:
                                    logger.error(
                                        "Failed to queue confirmation for scheduled rule %s: %s",
                                        rule_id, q_err,
                                    )
                                    total_actions_failed += 1
                        else:
                            # Execute actions immediately
                            for act in actions_list:
                                result = execute_action(
                                    act, entity_type, entity.get("id", ""),
                                    owner_id, rule_name, rule_id,
                                )
                                if result.get("success"):
                                    total_actions_executed += 1
                                else:
                                    total_actions_failed += 1

                    # ── 7. Build result summary ──────────────────
                    if total_actions_failed > 0 and total_actions_executed > 0:
                        result_summary = (
                            f"partial: {total_actions_executed} of "
                            f"{total_actions_executed + total_actions_failed} actions "
                            f"{'queued' if confirm else 'applied'} "
                            f"({entities_matched}/{entities_evaluated} entities matched)"
                        )
                    elif entities_matched > 0 and total_actions_executed > 0:
                        result_summary = (
                            f"success: {total_actions_executed} actions "
                            f"{'queued for confirmation' if confirm else 'applied'} "
                            f"({entities_matched}/{entities_evaluated} entities matched)"
                        )
                    elif entities_matched > 0 and total_actions_executed == 0 and total_actions_failed > 0:
                        result_summary = (
                            f"failed: all {total_actions_failed} actions failed "
                            f"({entities_matched}/{entities_evaluated} entities matched)"
                        )
                    elif entities_matched > 0 and not actions_list:
                        result_summary = (
                            f"matched {entities_matched}/{entities_evaluated} entities "
                            f"but no actions configured"
                        )
                    elif entities_matched == 0:
                        result_summary = f"no match (0/{entities_evaluated} entities)"
                    else:
                        result_summary = "completed"

                    # ── 8. Insert execution log entry ────────────
                    log_id = str(uuid4())
                    try:
                        cursor.execute(
                            "INSERT INTO rule_execution_log "
                            "(id, rule_id, owner_id, trigger_event, entities_evaluated, "
                            " entities_matched, actions_executed, actions_failed, "
                            " result_summary, executed_datetime) "
                            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                            (
                                log_id,
                                rule_id,
                                owner_id,
                                "scheduled",
                                entities_evaluated,
                                entities_matched,
                                total_actions_executed,
                                total_actions_failed,
                                result_summary,
                                current_time,
                            ),
                        )
                    except Exception as log_err:
                        logger.error(
                            "Failed to insert execution log for scheduled rule %s: %s",
                            rule_id, log_err,
                        )

                    # ── 9. Update rule metadata ──────────────────
                    try:
                        run_count = (rule.get("run_count") or 0) + 1
                        cursor.execute(
                            "UPDATE rules SET last_run_datetime = ?, run_count = ?, "
                            "last_run_result = ? WHERE id = ?",
                            (current_time, run_count, result_summary, rule_id),
                        )
                    except Exception as meta_err:
                        logger.error(
                            "Failed to update scheduled rule %s metadata: %s",
                            rule_id, meta_err,
                        )

                    # ── 10. Record habit history (if habit_mode) ─
                    if rule.get("habit_mode"):
                        try:
                            # Load existing habit_history
                            history_raw = rule.get("habit_history")
                            if isinstance(history_raw, str) and history_raw.strip():
                                habit_history = json.loads(history_raw)
                            else:
                                habit_history = []
                            if not isinstance(habit_history, list):
                                habit_history = []

                            # Append new entry — status is always "achieved"
                            # when the rule ran (maintenance rules succeed by running)
                            habit_entry = {
                                "date": now.strftime("%Y-%m-%d"),
                                "status": "achieved",
                                "entities_matched": entities_matched,
                                "actions_applied": total_actions_executed,
                                "executed_datetime": current_time,
                            }
                            habit_history.append(habit_entry)

                            # Trim to last 365 entries to prevent unbounded growth
                            if len(habit_history) > 365:
                                habit_history = habit_history[-365:]

                            # Write updated habit_history back to the rules table
                            cursor.execute(
                                "UPDATE rules SET habit_history = ? WHERE id = ?",
                                (json.dumps(habit_history), rule_id),
                            )
                            logger.info(
                                "Habit history recorded for rule '%s': %s",
                                rule_name, habit_entry,
                            )

                            # Fire habit_achieved trigger for other rules to react
                            _fire_habit_trigger(
                                "habit_achieved", rule_id, rule_name,
                                owner_id, habit_history, now,
                            )
                        except Exception as habit_err:
                            logger.error(
                                "Failed to record habit history for rule %s: %s",
                                rule_id, habit_err,
                            )

                    logger.info(
                        "Scheduled rule '%s' complete: %s", rule_name, result_summary
                    )

                conn.commit()

            except Exception as db_err:
                logger.error("Rules scheduler DB error: %s", db_err)
            finally:
                if conn:
                    conn.close()

        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.error("Rules scheduler unexpected error: %s", e)


# ── Habit Trigger Helpers ────────────────────────────────────────────

def _fire_habit_trigger(
    trigger_type: str,
    source_rule_id: str,
    source_rule_name: str,
    owner_id: str,
    habit_history: list,
    now: datetime,
):
    """Fire a habit_achieved or habit_missed trigger in a background thread.

    Builds a synthetic entity dict with habit metadata and dispatches it
    to the rules engine for any rules listening on that trigger type.
    """
    import threading
    from src.backend.rules_engine import dispatch_trigger

    # Compute streak from history
    streak = 0
    for entry in reversed(habit_history):
        if entry.get("status") == "achieved":
            streak += 1
        else:
            break

    # Build synthetic entity for condition evaluation
    entity = {
        "id": source_rule_id,
        "source_rule_id": source_rule_id,
        "source_rule_name": source_rule_name,
        "source_type": "rule",
        "source_chit_id": None,
        "habit_event": trigger_type.replace("habit_", ""),  # "achieved" or "missed"
        "streak": streak,
        "total_entries": len(habit_history),
        "last_status": habit_history[-1].get("status") if habit_history else None,
        "timestamp": now.isoformat(),
    }

    logger.info(
        "Firing %s trigger for habit rule '%s' (streak=%d, owner=%s)",
        trigger_type, source_rule_name, streak, owner_id,
    )

    threading.Thread(
        target=dispatch_trigger,
        args=(trigger_type, "habit", entity, owner_id),
        daemon=True,
    ).start()


def _fire_chit_habit_trigger(
    trigger_type: str,
    chit: dict,
    owner_id: str,
):
    """Fire a habit trigger for a chit-based habit (achieved/missed/due).

    Merges the full chit data with habit-specific metadata so condition
    trees can evaluate against any chit field (title, tags, location, etc.)
    as well as habit-specific fields (streak, habit_event, etc.).
    """
    import threading
    from src.backend.rules_engine import dispatch_trigger

    # Start with the full chit data so all fields are available for conditions
    entity = dict(chit)
    # Overlay habit-specific metadata
    entity.update({
        "source_rule_id": None,
        "source_rule_name": None,
        "source_type": "chit",
        "source_chit_id": chit.get("id", ""),
        "source_chit_title": chit.get("title", ""),
        "habit_event": trigger_type.replace("habit_", ""),
        "habit_goal": chit.get("habit_goal", 1),
        "habit_success": chit.get("habit_success", 0),
        "streak": 0,  # Would need recurrence_exceptions to compute
        "timestamp": datetime.utcnow().isoformat(),
    })

    logger.info(
        "Firing %s trigger for chit habit '%s' (chit_id=%s, owner=%s)",
        trigger_type, chit.get("title", ""), chit.get("id", ""), owner_id,
    )

    threading.Thread(
        target=dispatch_trigger,
        args=(trigger_type, "habit", entity, owner_id),
        daemon=True,
    ).start()


async def _habit_due_loop():
    """Background task: check for habit_due triggers with time offsets.

    Runs every 60 seconds. For each rule with trigger_type='habit_due',
    checks if the offset window matches the current time relative to the
    source habit's scheduled execution time.

    habit_trigger_config for habit_due:
    {
        "source_rule_id": "uuid" or "*",
        "source_type": "rule" | "chit",
        "source_chit_id": "uuid" or "*",
        "offset_minutes": int  # negative = before due, positive = after due
    }

    For rule-based habits: "due" means the cron is about to fire (offset before)
    or has passed without being achieved (offset after).

    For chit-based habits: "due" is relative to the chit's recurrence schedule.
    """
    from src.backend.rules_engine import dispatch_trigger
    from src.backend.cron_parser import parse_cron, matches

    first_run = True

    while True:
        try:
            if first_run:
                await asyncio.sleep(10)
                first_run = False
            else:
                await asyncio.sleep(60)

            now = datetime.utcnow()
            conn = None

            try:
                conn = sqlite3.connect(DB_PATH)
                cursor = conn.cursor()

                # Load all enabled rules with habit_due trigger type
                cursor.execute(
                    "SELECT * FROM rules WHERE trigger_type = 'habit_due' AND enabled = 1"
                )
                columns = [col[0] for col in cursor.description]
                due_rules = [dict(zip(columns, row)) for row in cursor.fetchall()]

                if not due_rules:
                    continue

                for due_rule in due_rules:
                    try:
                        _check_habit_due_rule(due_rule, now, cursor, conn)
                    except Exception as rule_err:
                        logger.error(
                            "habit_due check failed for rule %s: %s",
                            due_rule.get("id", "?"), rule_err,
                        )

                conn.commit()

            except Exception as db_err:
                logger.error("Habit due loop DB error: %s", db_err)
            finally:
                if conn:
                    conn.close()

        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.error("Habit due loop unexpected error: %s", e)


def _check_habit_due_rule(due_rule: dict, now: datetime, cursor, conn):
    """Check if a habit_due rule should fire based on its offset config.

    Compares the current time against the source habit's next scheduled time
    plus/minus the offset. Fires the trigger if within the 60-second window
    and hasn't already fired this period.
    """
    import threading
    from src.backend.rules_engine import dispatch_trigger
    from src.backend.cron_parser import parse_cron, matches

    rule_id = due_rule.get("id", "")
    owner_id = due_rule.get("owner_id", "")

    # Parse habit_trigger_config
    config_raw = due_rule.get("habit_trigger_config")
    if not config_raw:
        return
    if isinstance(config_raw, str):
        try:
            config = json.loads(config_raw)
        except (json.JSONDecodeError, TypeError):
            return
    else:
        config = config_raw

    if not isinstance(config, dict):
        return

    offset_minutes = config.get("offset_minutes", 0)
    source_type = config.get("source_type", "rule")
    source_rule_id = config.get("source_rule_id", "*")
    source_chit_id = config.get("source_chit_id", "*")

    # Check if this rule already fired this minute (prevent double-fire)
    last_run_raw = due_rule.get("last_run_datetime")
    if last_run_raw and isinstance(last_run_raw, str) and last_run_raw.strip():
        try:
            last_run = datetime.fromisoformat(last_run_raw.replace("Z", "+00:00")).replace(tzinfo=None)
            if (last_run.year == now.year and last_run.month == now.month
                    and last_run.day == now.day and last_run.hour == now.hour
                    and last_run.minute == now.minute):
                return
        except (ValueError, TypeError):
            pass

    # Determine if we should fire based on source habit's schedule
    should_fire = False
    entity = None

    if source_type == "rule":
        # Load the source habit rule to get its cron schedule
        if source_rule_id == "*":
            # Watch all habit rules — check each one
            cursor.execute(
                "SELECT * FROM rules WHERE owner_id = ? AND habit_mode = 1 AND enabled = 1",
                (owner_id,),
            )
        else:
            cursor.execute(
                "SELECT * FROM rules WHERE id = ? AND owner_id = ?",
                (source_rule_id, owner_id),
            )
        src_columns = [col[0] for col in cursor.description]
        source_rules = [dict(zip(src_columns, row)) for row in cursor.fetchall()]

        for src_rule in source_rules:
            src_config_raw = src_rule.get("schedule_config")
            if not src_config_raw:
                continue
            if isinstance(src_config_raw, str):
                try:
                    src_config = json.loads(src_config_raw)
                except (json.JSONDecodeError, TypeError):
                    continue
            else:
                src_config = src_config_raw

            cron_expr = src_config.get("cron") if isinstance(src_config, dict) else None
            if not cron_expr:
                continue

            # Calculate the target time: habit's scheduled time + offset
            # Check if (now - offset_minutes) matches the cron
            check_time = now - timedelta(minutes=offset_minutes)
            parsed = parse_cron(cron_expr)
            if parsed and matches(parsed, check_time):
                should_fire = True
                # Build entity
                history_raw = src_rule.get("habit_history")
                if isinstance(history_raw, str) and history_raw.strip():
                    try:
                        habit_history = json.loads(history_raw)
                    except (json.JSONDecodeError, TypeError):
                        habit_history = []
                else:
                    habit_history = []

                streak = 0
                for entry in reversed(habit_history if isinstance(habit_history, list) else []):
                    if entry.get("status") == "achieved":
                        streak += 1
                    else:
                        break

                entity = {
                    "id": src_rule.get("id", ""),
                    "source_rule_id": src_rule.get("id", ""),
                    "source_rule_name": src_rule.get("name", ""),
                    "source_type": "rule",
                    "source_chit_id": None,
                    "habit_event": "due",
                    "offset_minutes": offset_minutes,
                    "streak": streak,
                    "timestamp": now.isoformat(),
                }
                break  # Fire for the first matching source

    elif source_type == "chit":
        # For chit-based habits, check if the chit's recurrence schedule
        # plus offset matches now. This is more complex — simplified approach:
        # check if a habit chit is "due" today and the offset window matches.
        if source_chit_id == "*":
            cursor.execute(
                "SELECT id, title, habit, habit_goal, habit_success, "
                "       recurrence_rule, start_datetime, owner_id "
                "FROM chits WHERE owner_id = ? AND habit = 1 "
                "AND (deleted = 0 OR deleted IS NULL)",
                (owner_id,),
            )
        else:
            cursor.execute(
                "SELECT id, title, habit, habit_goal, habit_success, "
                "       recurrence_rule, start_datetime, owner_id "
                "FROM chits WHERE id = ? AND owner_id = ?",
                (source_chit_id, owner_id),
            )
        chit_rows = cursor.fetchall()
        chit_cols = [col[0] for col in cursor.description]
        chits = [dict(zip(chit_cols, row)) for row in chit_rows]

        for chit in chits:
            if not chit.get("habit"):
                continue
            # For chit habits, "due" is relative to start_datetime each day
            # Use start_datetime's time component as the "scheduled time"
            start_raw = chit.get("start_datetime")
            if not start_raw:
                # Default to midnight
                scheduled_hour, scheduled_minute = 0, 0
            else:
                try:
                    start_dt = datetime.fromisoformat(str(start_raw).replace("Z", "+00:00")).replace(tzinfo=None)
                    scheduled_hour = start_dt.hour
                    scheduled_minute = start_dt.minute
                except (ValueError, TypeError):
                    scheduled_hour, scheduled_minute = 0, 0

            # Build the scheduled time for today
            scheduled_today = now.replace(hour=scheduled_hour, minute=scheduled_minute, second=0, microsecond=0)
            # Apply offset
            target_time = scheduled_today + timedelta(minutes=offset_minutes)

            # Check if we're within the 60-second window of the target
            diff_seconds = abs((now - target_time).total_seconds())
            if diff_seconds <= 90:  # 90s grace for scheduler jitter
                should_fire = True
                entity = {
                    "id": chit.get("id", ""),
                    "source_rule_id": None,
                    "source_rule_name": None,
                    "source_type": "chit",
                    "source_chit_id": chit.get("id", ""),
                    "source_chit_title": chit.get("title", ""),
                    "habit_event": "due",
                    "offset_minutes": offset_minutes,
                    "habit_goal": chit.get("habit_goal", 1),
                    "habit_success": chit.get("habit_success", 0),
                    "streak": 0,
                    "timestamp": now.isoformat(),
                }
                break

    if should_fire and entity:
        logger.info(
            "habit_due rule '%s' firing (offset=%d min, source=%s)",
            due_rule.get("name", ""), offset_minutes,
            entity.get("source_rule_name") or entity.get("source_chit_title", "?"),
        )

        # Update last_run_datetime to prevent re-firing this minute
        current_time = now.isoformat()
        try:
            run_count = (due_rule.get("run_count") or 0) + 1
            cursor.execute(
                "UPDATE rules SET last_run_datetime = ?, run_count = ? WHERE id = ?",
                (current_time, run_count, rule_id),
            )
        except Exception:
            pass

        # Dispatch the trigger
        threading.Thread(
            target=dispatch_trigger,
            args=("habit_due", "habit", entity, owner_id),
            daemon=True,
        ).start()



async def start_rules_scheduler():
    """Register background rules engine tasks. Called from main.py on startup."""
    asyncio.create_task(_rules_scheduled_loop())
    asyncio.create_task(_habit_due_loop())
    logger.info("Rules scheduler task started (60-second polling loop)")
    logger.info("Habit due trigger loop started (60-second polling loop)")
