# W32: _showSnapGrid(container)

## What the web function does
Renders a visual overlay of horizontal lines at snap intervals during calendar drag operations:
- Creates an absolute-positioned div covering the full day height (1440px)
- Draws a faint horizontal line every `_calSnapMinutes` minutes
- Adds time labels (HH:MM) at each hour or at each snap interval if snap >= 30min
- Shown when drag starts, hidden when drag ends
- Purely visual aid — helps user see where events will snap to

## What exists on Android
Nothing. The snap logic works (events snap to grid intervals) but there's no visual overlay showing the grid lines during drag.

## What's missing
Visual snap grid overlay during drag. Low priority — the snap behavior works correctly without it, this is just a visual aid.

## Fix needed
During drag (when `isDragging` is true), render faint horizontal lines at snap intervals using Canvas or a semi-transparent overlay composable. Show time labels at intervals.
