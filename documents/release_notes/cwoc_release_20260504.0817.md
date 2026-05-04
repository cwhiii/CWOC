# CWOC Release 20260504.0817

Fixed signature editor modal not appearing as an overlay. Was using `.modal-overlay` class (only defined in editor.css) on the settings page which only loads shared-page.css. Switched to the standard `.modal` + `.modal-content` classes that all other settings page modals use. The signature editor now pops up as a proper overlay with dark backdrop, centered on screen.
