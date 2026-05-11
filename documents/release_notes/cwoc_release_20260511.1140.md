## v20260511.1140 — Mobile Drum Roller Time Picker (Dual Mode)

Replaced all time pickers with a custom iOS-style drum roller time picker. The new picker uses CSS scroll-snap for smooth native-feeling scroll on mobile, honors the 12/24 hour setting, and shows only hours and minutes. Time inputs now support dual-mode entry: tap the input to type a time directly with the numeric keyboard, or tap the 🕐 clock button to open the drum roller picker. Auto-formats typed input (inserts colon after 2 digits) and validates on blur.
