"""Property-based test for weather_data round-trip (Property 1).

**Validates: Requirements 1.2, 1.4, 1.5, 1.6, 8.1, 8.2**

Uses Python stdlib only (random, string, uuid, unittest). Minimum 100 iterations.
Generates random weather_data objects with random floats for high/low/precipitation,
random int 0-99 for weather_code, random ISO date for focus_date, random ISO timestamp
for updated_time. POSTs a chit, GETs it back, verifies weather_data equivalence with
exact numeric precision.

Runs against the live server at http://localhost:3333.
"""

import json
import random
import string
import unittest
import urllib.request
import urllib.error
from uuid import uuid4

BASE_URL = "http://localhost:3333"


def _random_iso_date():
    """Generate a random ISO date string (YYYY-MM-DD)."""
    year = random.randint(2020, 2030)
    month = random.randint(1, 12)
    day = random.randint(1, 28)  # safe for all months
    return f"{year:04d}-{month:02d}-{day:02d}"


def _random_iso_timestamp():
    """Generate a random ISO timestamp string."""
    date = _random_iso_date()
    hour = random.randint(0, 23)
    minute = random.randint(0, 59)
    second = random.randint(0, 59)
    return f"{date}T{hour:02d}:{minute:02d}:{second:02d}Z"


def _random_float(low=-50.0, high=60.0):
    """Generate a random float rounded to 1 decimal place."""
    return round(random.uniform(low, high), 1)


def _generate_weather_data():
    """Generate a random weather_data object."""
    return {
        "focus_date": _random_iso_date(),
        "updated_time": _random_iso_timestamp(),
        "high": _random_float(-50.0, 60.0),
        "low": _random_float(-50.0, 60.0),
        "precipitation": _random_float(0.0, 200.0),
        "weather_code": random.randint(0, 99),
    }


def _api_post(path, data):
    """POST JSON to the API and return parsed response."""
    url = f"{BASE_URL}{path}"
    body = json.dumps(data).encode("utf-8")
    req = urllib.request.Request(url, data=body, method="POST")
    req.add_header("Content-Type", "application/json")
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode("utf-8"))


def _api_get(path):
    """GET from the API and return parsed response."""
    url = f"{BASE_URL}{path}"
    req = urllib.request.Request(url, method="GET")
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode("utf-8"))


def _api_delete(path):
    """DELETE from the API."""
    url = f"{BASE_URL}{path}"
    req = urllib.request.Request(url, method="DELETE")
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError:
        pass


class TestWeatherDataRoundTrip(unittest.TestCase):
    """Property 1: Weather data round-trip.

    For any valid weather_data JSON object, creating a chit with that weather_data
    via POST and then loading the chit via GET SHALL return an equivalent weather_data
    object with exact numeric precision preserved.

    **Validates: Requirements 1.2, 1.4, 1.5, 1.6, 8.1, 8.2**
    """

    def _cleanup_chit(self, chit_id):
        """Soft-delete a chit after test."""
        _api_delete(f"/api/chits/{chit_id}")

    def test_weather_data_round_trip_property(self):
        """Property test: weather_data survives POST → GET round-trip with exact precision."""
        iterations = 100
        created_ids = []

        try:
            for i in range(iterations):
                weather_data = _generate_weather_data()
                weather_data_json = json.dumps(weather_data)

                # Create a chit with weather_data
                chit_payload = {
                    "title": f"Weather RT Test {i} - {uuid4().hex[:8]}",
                    "weather_data": weather_data_json,
                }

                created = _api_post("/api/chits", chit_payload)
                chit_id = created["id"]
                created_ids.append(chit_id)
                self.assertIsNotNone(chit_id, f"Iteration {i}: No id returned from POST")

                # GET the chit back
                retrieved = _api_get(f"/api/chit/{chit_id}")

                # Verify weather_data equivalence
                retrieved_wd = retrieved.get("weather_data")
                self.assertIsNotNone(
                    retrieved_wd,
                    f"Iteration {i}: weather_data is None after GET. "
                    f"Sent: {weather_data_json}"
                )

                # Compare each field with exact precision
                self.assertEqual(
                    retrieved_wd["focus_date"], weather_data["focus_date"],
                    f"Iteration {i}: focus_date mismatch"
                )
                self.assertEqual(
                    retrieved_wd["updated_time"], weather_data["updated_time"],
                    f"Iteration {i}: updated_time mismatch"
                )
                self.assertEqual(
                    retrieved_wd["high"], weather_data["high"],
                    f"Iteration {i}: high mismatch - sent {weather_data['high']}, got {retrieved_wd['high']}"
                )
                self.assertEqual(
                    retrieved_wd["low"], weather_data["low"],
                    f"Iteration {i}: low mismatch - sent {weather_data['low']}, got {retrieved_wd['low']}"
                )
                self.assertEqual(
                    retrieved_wd["precipitation"], weather_data["precipitation"],
                    f"Iteration {i}: precipitation mismatch - sent {weather_data['precipitation']}, got {retrieved_wd['precipitation']}"
                )
                self.assertEqual(
                    retrieved_wd["weather_code"], weather_data["weather_code"],
                    f"Iteration {i}: weather_code mismatch"
                )

        finally:
            # Cleanup: soft-delete all created chits
            for cid in created_ids:
                try:
                    self._cleanup_chit(cid)
                except Exception:
                    pass

    def test_weather_data_null_round_trip(self):
        """Edge case: chit with no weather_data should return None/null."""
        chit_payload = {
            "title": f"No Weather Test - {uuid4().hex[:8]}",
        }
        created = _api_post("/api/chits", chit_payload)
        chit_id = created["id"]

        try:
            retrieved = _api_get(f"/api/chit/{chit_id}")
            self.assertIsNone(
                retrieved.get("weather_data"),
                "weather_data should be None when not set"
            )
        finally:
            self._cleanup_chit(chit_id)

    def test_weather_data_update_round_trip(self):
        """Property: weather_data survives PUT → GET round-trip."""
        iterations = 100
        created_ids = []

        try:
            for i in range(iterations):
                # Create a chit without weather_data
                chit_payload = {
                    "title": f"Weather Update RT {i} - {uuid4().hex[:8]}",
                }
                created = _api_post("/api/chits", chit_payload)
                chit_id = created["id"]
                created_ids.append(chit_id)

                # Update with weather_data via PUT
                weather_data = _generate_weather_data()
                weather_data_json = json.dumps(weather_data)

                update_payload = {
                    "title": created.get("title", ""),
                    "weather_data": weather_data_json,
                }

                url = f"{BASE_URL}/api/chits/{chit_id}"
                body = json.dumps(update_payload).encode("utf-8")
                req = urllib.request.Request(url, data=body, method="PUT")
                req.add_header("Content-Type", "application/json")
                with urllib.request.urlopen(req) as resp:
                    resp.read()

                # GET the chit back
                retrieved = _api_get(f"/api/chit/{chit_id}")
                retrieved_wd = retrieved.get("weather_data")

                self.assertIsNotNone(
                    retrieved_wd,
                    f"Iteration {i}: weather_data is None after PUT+GET"
                )

                # Compare each field
                for field in ["focus_date", "updated_time", "high", "low", "precipitation", "weather_code"]:
                    self.assertEqual(
                        retrieved_wd[field], weather_data[field],
                        f"Iteration {i}: {field} mismatch after PUT - sent {weather_data[field]}, got {retrieved_wd[field]}"
                    )

        finally:
            for cid in created_ids:
                try:
                    self._cleanup_chit(cid)
                except Exception:
                    pass


if __name__ == "__main__":
    unittest.main()
