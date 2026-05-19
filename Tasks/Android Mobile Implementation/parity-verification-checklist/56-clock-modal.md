# Clock Modal

**Category:** Modals & Overlays
**Item #:** 56
**Code Verified:** ✅
**User Verified:** ⬜

## Functions, Buttons, Controls & Inputs

### Core Functions (main-modals.js)
- [ ] _openClockModal — Opens the clock modal (toggle: if already open, closes it); loads active_clocks and alarm_orientation from settings
- [ ] _closeClockModal — Removes the clock modal overlay and clears the 1-second interval
- [ ] _renderClocks — Renders all active clock faces into the container (called every 1 second); shows date line + each clock type
- [ ] _renderAnalogClock — Renders a full SVG analog clock face with hour/minute/second hands, numerals, tick marks, and gradient background
- [ ] _renderHSTClock — Renders the Holeman Simplified Time progress bar (day fraction as percentage with gradient fill)

### Clock Types Supported
- [ ] 24hour — Digital 24-hour clock display (HH:MM:SS Hours)
- [ ] 12hour — Digital 12-hour clock display (H:MM:SS AM/PM)
- [ ] 12houranalog — SVG analog clock with hour markers, numerals, hour/minute/second hands, center cap
- [ ] hst / metric — HST progress bar (day fraction × 100, displayed as "XX.XXX sd")
- [ ] metricbar / hstbar — Same as hst (alias)

### Display Elements
- [ ] Date line — Shows "YYYY-Mon-DD DayName" in letter-spaced format above clocks
- [ ] Clock orientation — Horizontal (row) or Vertical (column) layout based on alarm_orientation setting
- [ ] Alternating background colors — bgColors array for non-HST clocks in horizontal mode

### Controls & Interactions
- [ ] ESC key — Closes the modal (via page-level ESC handler)
- [ ] Click outside (overlay click) — Closes the modal
- [ ] Close hint text — "ESC or click outside to close" (clickable, also closes modal)
- [ ] 1-second interval timer — Auto-updates all clock displays every second

### Settings Dependencies
- [ ] active_clocks — JSON array from settings determining which clocks to show (default: ['24hour', '12hour', 'hst'])
- [ ] alarm_orientation — "Horizontal" or "Vertical" layout (default: "Horizontal")

### SVG Analog Clock Details
- [ ] Radial gradient background (parchment-themed)
- [ ] Outer ring (dark brown #5c3a1e)
- [ ] Inner ring (#8b4513)
- [ ] 12 hour markers (thicker at quarters)
- [ ] 60 minute tick marks (thin, 0.4 opacity)
- [ ] Hour numerals (1-12, Lora font, bold)
- [ ] Hour hand (thick, #4a2c2a, stroke-width 6)
- [ ] Minute hand (medium, #4a2c2a, stroke-width 4)
- [ ] Second hand (thin, #a0522d, stroke-width 1.5, with tail)
- [ ] Center cap (gold #d4af37 with dark border)

### State
- [ ] _clockModalInterval — Stores the setInterval ID for the 1-second update loop
