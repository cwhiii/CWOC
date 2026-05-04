# CWOC Release 20260504.0734

Fixed quick-create from email view not opening expanded mode (was missing &expand=email in the sidebar Create Chit URL).

Email save buttons are now content-aware: normal Save buttons show until there's actual email content (To, Subject, or Body). Once any email field has content, Save as Draft appears. Send buttons only appear when all three fields have content.

Signature preview now respects single line breaks (marked.js `breaks: true`). Added Ctrl+B (bold), Ctrl+I (italic), Ctrl+K (link) keyboard shortcuts to the signature textarea. For links, if selected text is a URL it becomes the href; otherwise it becomes the display text with cursor placed in the URL field.
