# Release 20260512.0951

Fixed birthday event concave-notch shape not displaying in week view. Moved the clip-path from the outer container (.all-day-event.birthday-event) to the inner .birthday-chip element, which is the element that actually has the visible background color. The outer container is now transparent with overflow:hidden to prevent the chip from overflowing its grid cell bounds. Removed the pill-shaped border-radius from the chip so the concave notch shape is the only visual treatment.
