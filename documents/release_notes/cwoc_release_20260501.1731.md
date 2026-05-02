# Release 20260501.1731

Fixed haptic vibration not firing on Firefox Android during long-press drag gestures. Firefox requires `navigator.vibrate()` to be called from a direct user gesture context, but all vibrate calls were inside `setTimeout` callbacks which lose that context. Added a 1ms vibration prime in each `touchstart` handler so subsequent vibrate calls in the delayed callbacks work correctly.
