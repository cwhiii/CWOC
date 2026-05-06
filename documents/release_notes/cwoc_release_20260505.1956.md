## v20260505.1956

Fixed live preview to use shared code (`cwocWireLivePreview`/`cwocUpdateLivePreview` in shared-utils.js) for both Notes and Email expand modals — one function, two callers. Fixed notes live preview treating content as a single line by switching from contenteditable div to textarea. Renamed toggle labels to "Live" / "Render". Moved Render button to the left of the toggle so it doesn't shift. Made the 2-value toggle clickable anywhere (delegated click handler in shared-utils.js).
