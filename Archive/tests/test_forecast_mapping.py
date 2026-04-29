"""
Property 3: Forecast-to-weather_data mapping

Feature: chit-weather-forecasts, Property 3: Forecast-to-weather_data mapping

Validates: Requirements 3.3, 4.3, 5.3

Generate random Open-Meteo-shaped responses and random focus dates from within
the response. Verify mapping produces correct field values at the matching index.
Uses Python stdlib only. Minimum 100 iterations.
"""

import sys
import os
import random
import unittest
from datetime import datetime, timedelta

# Add backend to path so we can import helpers
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from backend.main import _extract_weather_for_date


def _generate_random_forecast(num_days=None):
    """Generate a random Open-Meteo daily response object."""
    if num_days is None:
        num_days = random.randint(1, 16)
    base_date = datetime(2025, 1, 1) + timedelta(days=random.randint(0, 365))
    times = []
    temp_max = []
    temp_min = []
    precip = []
    weathercodes = []

    for i in range(num_days):
        dt = base_date + timedelta(days=i)
        times.append(dt.strftime("%Y-%m-%d"))
        high = round(random.uniform(-30.0, 50.0), 1)
        low = round(random.uniform(-40.0, high), 1)
        temp_max.append(high)
        temp_min.append(low)
        precip.append(round(random.uniform(0.0, 100.0), 1))
        weathercodes.append(random.randint(0, 99))

    return {
        "time": times,
        "temperature_2m_max": temp_max,
        "temperature_2m_min": temp_min,
        "precipitation_sum": precip,
        "weathercode": weathercodes,
    }


class TestForecastMapping(unittest.TestCase):
    """Property 3: Forecast-to-weather_data mapping

    **Validates: Requirements 3.3, 4.3, 5.3**
    """

    def test_mapping_produces_correct_field_values(self):
        """For any valid forecast and focus date within it, the mapping must
        produce correct field values at the matching index."""
        for iteration in range(150):
            forecast_daily = _generate_random_forecast()
            times = forecast_daily["time"]

            # Pick a random date that IS in the response
            idx = random.randint(0, len(times) - 1)
            focus_date = times[idx]

            result = _extract_weather_for_date(forecast_daily, focus_date)

            self.assertIsNotNone(
                result,
                f"Iteration {iteration}: mapping returned None for date {focus_date} that exists in response"
            )

            # Verify each field matches the correct index
            self.assertEqual(
                result["focus_date"], focus_date,
                f"Iteration {iteration}: focus_date mismatch"
            )
            self.assertEqual(
                result["high"], forecast_daily["temperature_2m_max"][idx],
                f"Iteration {iteration}: high temp mismatch at index {idx}"
            )
            self.assertEqual(
                result["low"], forecast_daily["temperature_2m_min"][idx],
                f"Iteration {iteration}: low temp mismatch at index {idx}"
            )
            self.assertEqual(
                result["precipitation"], forecast_daily["precipitation_sum"][idx],
                f"Iteration {iteration}: precipitation mismatch at index {idx}"
            )
            self.assertEqual(
                result["weather_code"], forecast_daily["weathercode"][idx],
                f"Iteration {iteration}: weather_code mismatch at index {idx}"
            )

            # updated_time should be a valid ISO timestamp
            self.assertIn("updated_time", result)
            self.assertIsNotNone(result["updated_time"])

    def test_missing_date_returns_none(self):
        """For any focus date NOT in the response, the mapping must return None."""
        for iteration in range(100):
            forecast_daily = _generate_random_forecast()
            # Generate a date that is definitely not in the response
            missing_date = "1900-01-01"
            result = _extract_weather_for_date(forecast_daily, missing_date)
            self.assertIsNone(
                result,
                f"Iteration {iteration}: expected None for missing date, got {result}"
            )


if __name__ == "__main__":
    unittest.main()
