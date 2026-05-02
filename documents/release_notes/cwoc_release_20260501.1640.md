# Release 20260501.1640

Mobile header swipe and profile image positioning fixes:

- Swiping left/right on the mobile header bar (across logo, title, views button, or profile image) now correctly cycles through views. Previously the swipe was attached to the hidden `.tabs` element.
- Profile image is now positioned tight against the Views button on mobile, with only a 4px gap matching the hamburger-to-logo spacing on the left side. Uses CSS `order` to ensure views-btn → profile-menu ordering.
