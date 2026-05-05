# Release 20260504.2028

Completed the Obsidian-style token-level live preview engine for the Notes and Email body editors. The system renders all inline markdown as formatted HTML except the specific token the cursor touches, which reveals its raw syntax for editing. Supports three cycling modes (Source → Live Preview → Reading), a format toolbar with keyboard shortcuts (Ctrl+B/I/K/E, Ctrl+Shift+X/1/2/3/7/8/./-), Enter/Backspace line splitting/merging, paste handling, mobile touch support with virtual keyboard awareness, and full reuse for the Email body editor with independent state.
