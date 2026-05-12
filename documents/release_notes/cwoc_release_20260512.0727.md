# Release 20260512.0727

Fixed month compress mode to properly fit all dates within the viewport. Grid now uses `height: 0; min-height: 0` with `grid-auto-rows: 1fr` to force equal row distribution within the available space. Overflow detection uses double-rAF for reliable post-layout measurement.
