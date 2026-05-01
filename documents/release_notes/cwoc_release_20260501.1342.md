# Release 20260501.1342

Fixed the "Add to Project" dropdown being clipped by the zone container's `overflow: hidden`. The menu is now appended to `document.body` and positioned dynamically relative to the trigger button, so it floats above all containers without clipping.
