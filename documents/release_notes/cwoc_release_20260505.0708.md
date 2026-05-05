## Release 20260505.0708

Global search now supports full boolean expressions on both text and tags. `&&` (AND, default), `||` (OR), `!` (NOT), and `()` grouping all work on any term. Examples: `el !hello` finds "elizabeth" but excludes "hello"; `(meeting || lunch) && #work && !cancelled` combines text and tag logic. Sub-tag hierarchy matching preserved.
