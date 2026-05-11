# Release 20260509.2233

Fixed pinning (and archive) from context menu failing with 422 error. The GET endpoint returns extra fields (owner_id, effective_role, assigned_to_display_name) that the Pydantic Chit model rejected on PUT. Added `extra = "ignore"` to the Chit model Config so it silently drops unknown fields.
