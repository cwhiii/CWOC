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
        from src.backend.routes.ntfy import send_ntfy_notification
    except ImportError:
        logger.debug("Ntfy routes not available — skipping ntfy notification")
        return
    except Exception as e:
        logger.debug(f"Could not import ntfy routes: {e}")
        return

    try:
        title = chit_title if chit_title else "CWOC Reminder"
        body = f"{time_label} {time_value}"
        click_url = f"/frontend/html/editor.html?id={chit_id}"
        tags = "alarm_clock" if "Alarm" in time_label else "calendar"

        result = send_ntfy_notification(
            user_id=owner_id,
            title=title,
            body=body,
            click_url=click_url,
            tags=tags,
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
    """Background task: send push notifications when chit start/due times arrive.

    Runs every 60 seconds. Checks for non-deleted chits whose start_datetime
    or due_datetime falls within the last 60-second window. Sends a push
    notification to the chit owner for each match.

    Handles pywebpush not being installed gracefully (logs and skips).
    """
    while True:
        try:
            await asyncio.sleep(60)  # Check every 60 seconds
            now = datetime.utcnow()
            window_start = now - timedelta(seconds=60)
            now_iso = now.isoformat()
            window_start_iso = window_start.isoformat()

            try:
                conn = sqlite3.connect(DB_PATH)
                cursor = conn.cursor()
                # Find chits whose start_datetime or due_datetime falls in the last 60s window
                cursor.execute(
                    "SELECT id, title, start_datetime, due_datetime, owner_id, alerts "
                    "FROM chits "
                    "WHERE (deleted = 0 OR deleted IS NULL) "
                    "AND owner_id IS NOT NULL AND owner_id != '' "
                    "AND ("
                    "  (start_datetime IS NOT NULL AND start_datetime > ? AND start_datetime <= ?) "
                    "  OR (due_datetime IS NOT NULL AND due_datetime > ? AND due_datetime <= ?)"
                    ")",
                    (window_start_iso, now_iso, window_start_iso, now_iso),
                )
                rows = cursor.fetchall()
                columns = [col[0] for col in cursor.description]
                chits = [dict(zip(columns, row)) for row in rows]
                conn.close()
            except Exception as e:
                logger.error(f"Alert push loop: DB query error: {e}")
                continue

            if not chits:
                continue

            logger.info(f"Alert push loop: found {len(chits)} chit(s) with arriving times")

            for chit in chits:
                chit_id = chit.get("id")
                chit_title = chit.get("title") or "CWOC Reminder"
                owner_id = chit.get("owner_id")
                start_dt = chit.get("start_datetime")
                due_dt = chit.get("due_datetime")

                if not owner_id:
                    continue

                # Send push for start_datetime if it's in the window
                if start_dt and window_start_iso < start_dt <= now_iso:
                    try:
                        dt = datetime.fromisoformat(start_dt.replace("Z", "+00:00"))
                        time_str = dt.strftime("%I:%M %p").lstrip("0")
                    except (ValueError, TypeError):
                        time_str = start_dt
                    _send_chit_push(owner_id, chit_id, chit_title, "Starts at", time_str)
                    try:
                        _send_chit_ntfy(owner_id, chit_id, chit_title, "Starts at", time_str)
                    except Exception as e:
                        logger.warning(f"Ntfy call failed for chit {chit_id} start: {e}")

                # Send push for due_datetime if it's in the window
                if due_dt and window_start_iso < due_dt <= now_iso:
                    try:
                        dt = datetime.fromisoformat(due_dt.replace("Z", "+00:00"))
                        time_str = dt.strftime("%I:%M %p").lstrip("0")
                    except (ValueError, TypeError):
                        time_str = due_dt
                    _send_chit_push(owner_id, chit_id, chit_title, "Due at", time_str)
                    try:
                        _send_chit_ntfy(owner_id, chit_id, chit_title, "Due at", time_str)
                    except Exception as e:
                        logger.warning(f"Ntfy call failed for chit {chit_id} due: {e}")

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
