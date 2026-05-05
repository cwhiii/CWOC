## v20260504.2154 — Fix birthday endpoint route ordering

Moved `/api/contacts/birthdays` endpoint before `/api/contacts/{contact_id}` routes so FastAPI doesn't match "birthdays" as a contact_id parameter. Birthday entries now actually return data and display on the calendar with person chip styling.
