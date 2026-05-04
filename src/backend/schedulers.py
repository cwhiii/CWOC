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
from datetime import datetime, timedelta

from src.backend.db import DB_PATH, _update_lock, serialize_json_field


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
        f"&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_sum"
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
                    focus_date_str = _get_chit_focus_date(chit)
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
                            focus_date_str = _get_chit_focus_date(chit)
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
                            focus_date_str = _get_chit_focus_date(chit)
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
                    "SELECT id, title, start_datetime, due_datetime, owner_id, alerts, "
                    "       status, habit, habit_goal, habit_success "
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
                due_dt = chit.get("due_datetime")

                if not owner_id:
                    continue

                # ── 1. Start/due time notifications (existing) ──────────────

                if start_dt and window_start_iso < start_dt <= now_iso:
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

                if due_dt and window_start_iso < due_dt <= now_iso:
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

                        # Compute offset
                        unit_seconds = {
                            "minutes": 60, "hours": 3600,
                            "days": 86400, "weeks": 604800
                        }
                        offset_secs = int(value) * unit_seconds.get(unit, 60)

                        # Determine target datetime
                        target_type = alert.get("targetType", "start")
                        if target_type == "due":
                            target_str = due_dt or start_dt
                        else:
                            target_str = start_dt or due_dt
                        if not target_str:
                            continue

                        try:
                            target_dt = datetime.fromisoformat(target_str.replace("Z", "+00:00")).replace(tzinfo=None)
                        except (ValueError, TypeError):
                            continue

                        # before = target - offset, after = target + offset
                        after_target = alert.get("afterTarget", False)
                        if after_target:
                            fire_dt = target_dt + timedelta(seconds=offset_secs)
                        else:
                            fire_dt = target_dt - timedelta(seconds=offset_secs)

                        fire_iso = fire_dt.isoformat()
                        if window_start_iso < fire_iso <= now_iso:
                            key = f"notif-{chit_id}-{idx}-{fire_iso[:16]}"
                            if key in _fired_keys:
                                continue
                            _fired_keys.add(key)
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
    logger.info("Weather scheduler tasks started (hourly + daily + alert push)")


# ══════════════════════════════════════════════════════════════════════════
# Rules Engine — Scheduled Rule Execution
# ══════════════════════════════════════════════════════════════════════════

from src.backend.db import deserialize_json_field


def _is_scheduled_rule_due(rule: dict, now: datetime) -> bool:
    """Check whether a scheduled rule is due for execution based on its
    schedule_config and last_run_datetime.

    schedule_config JSON shape:
        {"frequency": "daily"|"hourly", "interval": int, "time_of_day": "HH:MM"}

    Returns True when enough time has elapsed since the last run.
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


async def start_rules_scheduler():
    """Register the background rules scheduler task. Called from main.py on startup."""
    asyncio.create_task(_rules_scheduled_loop())
    logger.info("Rules scheduler task started (60-second polling loop)")
