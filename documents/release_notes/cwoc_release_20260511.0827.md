# Release 20260511.0923

Further Android attachment fixes: added 0-byte file check (Android can return empty File objects from content URIs). Made getAttachmentsData() return undefined (not null) when pending uploads exist but data array is empty — prevents save from overwriting server data. Backend preserves existing attachments when the field isn't in the PUT payload.
