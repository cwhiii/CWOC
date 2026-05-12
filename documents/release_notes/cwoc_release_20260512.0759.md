# Release 20260512.0759

Fixed month drag 422 error — only stringify fields that the Pydantic model expects as strings (health_data, recurrence_rule, recurrence_exceptions). List fields (tags, checklist, people, etc.) are already in the correct format from the GET response.
