# CWOC Release 20260506.1505

Codebase cleanup: split oversized JS files into focused modules for faster code generation and easier maintenance.

- **settings.js** (5,416 lines → 7 files): settings-email.js, settings-data.js, settings-sharing.js, settings-integrations.js, settings-version.js, settings-views.js, and a slimmed-down settings.js core (~1,593 lines)
- **shared.js** (3,864 lines → 5 files): shared-mobile.js, shared-weather.js, shared-alarms.js, shared-habits.js, and a slimmed-down shared.js coordinator (~1,794 lines)
- Updated all HTML pages to load the new scripts in the correct order
