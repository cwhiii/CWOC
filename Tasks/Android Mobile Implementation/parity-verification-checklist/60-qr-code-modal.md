# QR Code Modal

**Category:** Modals & Overlays
**Item #:** 60
**Code Verified:** ✅
**User Verified:** ⬜

## Functions, Buttons, Controls & Inputs

### Core Functions (shared-qr.js)
- [ ] showQRModal(opts) — Single source of truth for ALL QR code display across the app; creates full-screen modal with QR code rendered via qrcode.js library

### Parameters (opts object)
- [ ] opts.title — Modal title text (e.g., "🔗 Link QR Code", "📦 Data QR Code")
- [ ] opts.data — The string to encode in the QR code
- [ ] opts.info — Small info text below the QR (e.g., URL or byte count)
- [ ] opts.ecl — Error correction level: 'L', 'M', 'Q', 'H' (default 'M')
- [ ] opts.onClose — Callback function when modal closes

### Display Elements
- [ ] Title text — Bold, parchment-themed (#4a2c2a), word-wrap enabled
- [ ] QR code image — Rendered via qrcode.js library; auto-sized to fit modal (max ~280px, responsive to viewport)
- [ ] Cell size calculation — Math.max(2, Math.floor(maxSize / moduleCount)) for optimal resolution
- [ ] Info text — Small (0.75em), faded (0.5 opacity), word-break: break-all for long URLs
- [ ] Error message — "Data too large for QR code." if encoding fails
- [ ] Library missing message — "QR library not loaded." if qrcode is undefined

### Controls & Interactions
- [ ] "✕ Close" button — Full-width, min-height 44px (touch-friendly), brown themed (#8b5a2b bg, #fff8e1 text)
- [ ] ESC key — Closes modal (capture phase, stopImmediatePropagation to prevent other handlers)
- [ ] Click backdrop — Closes modal (click on overlay outside modal content)
- [ ] onClose callback — Called when modal is dismissed by any method

### Modal Styling
- [ ] Overlay — Fixed, full-screen, semi-transparent black (rgba 0,0,0,0.5), z-index 99999, flex centered, 12px padding
- [ ] Modal card — #fff8e1 background, #8b4513 border (2px solid), 10px border-radius, 20px padding, max-width 360px, max-height 90vh with overflow-y auto
- [ ] Box shadow — 0 8px 32px rgba(0,0,0,0.4)

### Singleton Behavior
- [ ] Removes existing QR modal (id: cwoc-qr-overlay) before creating new one
- [ ] Returns the overlay element for further customization

### Usage Contexts
- [ ] Quick-edit modal QR button — Data QR (chit JSON) or Link QR (editor URL, shift+click)
- [ ] Contact QR — vCard data encoding
- [ ] Editor QR — Chit data or link sharing
