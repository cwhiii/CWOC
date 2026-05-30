## cwoc_server-20260529_1951

Fixed calendar drag-drop causing 422 errors and chits disappearing: when breaking off a recurring instance ("This instance only"), the code now clears `nest_thread_id` and other fields that shouldn't be inherited by the new standalone chit. Added proper error handling and user feedback (toast notifications) to all calendar drag operations — week view move/resize, month view drag, all-day drag, and all recurring instance options.

## cwoc_server-20260529_1601

Fixed Reminders section showing when empty — restored forced hideWhenEmpty for reminders (transient by nature, should never show an empty placeholder). Added diagnostic logging for chrono/ondeck/reminders counts to help debug event display issues.

## cwoc_server-20260529_1411

HST bars: added "Show Weather" and "Show Events" checkboxes to each HST-type card in the Arrange Omni Layout modal (HST Bar, HST Weather Strip, HST + Weather, Events & Weather). When unchecked, the bar won't render those icons. Click-to-cycle mode still works — it cycles through only the modes enabled by the checkboxes. Also added 1px separator line between HST bar and temperature strip.

## cwoc_server-20260529_1334

Fixed Omni View layout configuration not being applied correctly: added missing "Events & Weather" section renderer so it actually displays when configured, removed forced hideWhenEmpty override on Reminders so the eye-toggle setting is respected, and added events_weather to the hide-when-empty exclusion list (bars are never empty).

## cwoc_server-20260529_1416

Updated README.md, documents/README.md, and documents/technical_details.md to fully reflect the current project scope — 25 HTML pages, 33 backend route modules, 32 Android screens, multi-user auth, sharing, rules engine, badges, maps, custom objects, Restic backup, kiosk, timeline view, email bundles, and all other features added since the last documentation pass.

## cwoc_server-20260529_1400

About modal now mentions the Android app and links to https://www.cwholemaniii.com/cwoc for more info and download.

## cwoc_server-20260529_1352

About modal: clicking "C.W.'s Omni Chits" in the sidebar footer, dashboard footer, or any secondary page footer now opens an About modal with app info, creator credit, and Buy Me a Coffee (PayPal) link. Also added an "About CWOC & Support" button at the top of the Help page index. On first login, the modal auto-shows and shrink-animates down to the sidebar link when closed.
