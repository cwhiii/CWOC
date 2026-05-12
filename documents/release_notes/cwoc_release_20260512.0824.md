# Release 20260512.0824

Fixed drag for recurring chits — removed recurrence_rule and recurrence_exceptions from stringify list (Pydantic expects them as dict/list, not strings). Only health_data and weather_data need stringifying.
