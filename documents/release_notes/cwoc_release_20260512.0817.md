# Release 20260512.0817

Fixed month compress grid — stripped back to minimal CSS overrides. No longer changes gap, borders, or width from the base month-grid styles (which work correctly in scroll mode). Compress mode now only adds height constraints (grid-auto-rows:1fr, height:0, overflow:hidden) and single-line event styling.
