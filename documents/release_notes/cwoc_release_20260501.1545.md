# Release 20260501.1545

Fixed: compact assign badge not showing active on chit load. The chips were rendered before the assigned-to dropdown value was set, so the badge always read an empty value. Added a second _renderPeopleChips() call after the dropdown value is populated.
