# CWOC Release 20260504.0827

Added live markdown preview for email compose. Draft emails now show a rendered HTML preview below the textarea that updates as you type (debounced 500ms). The expand modal gets the same preview. On send, the backend converts the full markdown body to proper HTML via multipart/alternative, so recipients see nicely formatted emails. The backend markdown converter was enhanced to support headers, lists, blockquotes, inline code, and horizontal rules.
