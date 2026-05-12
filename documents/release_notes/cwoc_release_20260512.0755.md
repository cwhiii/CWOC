# Release 20260512.0755

Fixed month drag save: switched back to PUT (which passes auth) and re-serialize JSON fields (tags, checklist, etc.) before sending to avoid 422 validation errors. The PATCH endpoint was returning 401 due to a cookie/auth issue specific to that endpoint.
