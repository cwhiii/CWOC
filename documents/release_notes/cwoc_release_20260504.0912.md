# CWOC Release 20260504.0912

Full keyboard shortcuts for all email formatting actions, working in both the small zone and expanded editor:
- Ctrl+B → Bold, Ctrl+I → Italic, Ctrl+K → Link
- Ctrl+Shift+X → Strikethrough (new)
- Ctrl+Shift+8 → Bullet list
- Ctrl+Shift+7 → Numbered list

Added strikethrough support: ~~text~~ renders as strikethrough in preview and sent HTML. New S̶ button in the expanded editor toolbar. Backend _markdown_to_html converts ~~text~~ to del tags.
