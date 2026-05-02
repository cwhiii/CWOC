# Release 20260501.1747

Fixed haptic vibration not working on Android Firefox during drag/long-press gestures. The 30ms vibration duration was below the minimum threshold many Android devices will actually produce. Increased to 200ms for drag activation and a [200, 100, 200] pattern for long-press. Added centralized `_cwocVibrate()` helper that cancels any ongoing vibration before firing a new one, improving reliability across Android browsers and devices.
